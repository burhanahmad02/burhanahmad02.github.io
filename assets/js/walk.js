/*
	Burhan Ahmad, walk-through portfolio.

	The page scrolls normally. Scroll position is a distance along a winding
	LED floor laid out as a timeline, from Islamabad in 2017 to Dubai now.
	Burhan (a cut-out made from his photo, rigged and drawn to a canvas every
	frame) walks toward the camera, so the front-facing photo reads as a
	natural walk. Milestone gates mark each move in his career, and each
	project rises out of the floor behind him as he reaches it: its footage
	on an LED wall and a small scene built from the project itself.

	Three.js r124 (global THREE) plus its example add-ons for the mirror floor
	and bloom. No build step.
*/
(function () {
	'use strict';

	var root = document.documentElement;
	var stops = [].slice.call(document.querySelectorAll('.stop'));
	var projects = stops.filter(function (s) { return s.classList.contains('stop-project'); });
	var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
	// set by the 3D walk once it is running; both stay no-ops in lite mode
	var walk = { pause: function () {}, resume: function () {}, goTo: null };

	/* ---------- Dialogs: video player, selected work, project details ---------- */

	// the walk pauses while any dialog is open and picks up again when the last one closes
	var openDialogs = 0, lastFocus = [];
	function showDialog(d) {
		if (d.open) return;
		lastFocus.push(document.activeElement);
		if (openDialogs++ === 0) walk.pause();
		if (d.showModal) d.showModal(); else d.setAttribute('open', '');
	}
	function hideDialog(d) {
		if (!d.open) return;
		if (d.close) d.close(); else { d.removeAttribute('open'); dialogClosed(d); }
	}
	function dialogClosed() {
		openDialogs = Math.max(0, openDialogs - 1);
		var f = lastFocus.pop();
		if (f && f.focus && document.contains(f)) f.focus({ preventScroll: true });
		if (openDialogs === 0) walk.resume();
	}
	function unload(v) { v.pause(); v.removeAttribute('src'); v.load(); }

	var player = document.querySelector('.player');
	var playerVideo = player.querySelector('video');
	function openPlayer(stop) {
		var full = stop.getAttribute('data-full');
		var clip = stop.getAttribute('data-video');
		playerVideo.onerror = function () {
			if (clip && playerVideo.getAttribute('src') !== clip) { playerVideo.src = clip; playerVideo.play().catch(function () {}); }
		};
		playerVideo.muted = false;
		playerVideo.poster = stop.getAttribute('data-poster') || '';
		playerVideo.src = full || clip;
		showDialog(player);
		playerVideo.play().catch(function () {});
	}
	player.querySelector('.player-close').addEventListener('click', function () { hideDialog(player); });
	player.addEventListener('click', function (e) { if (e.target === player) hideDialog(player); });
	player.addEventListener('close', function () { unload(playerVideo); dialogClosed(); });

	function text(el, sel) { var n = el.querySelector(sel); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }
	var CATS = [
		{ key: '', label: 'All' },
		{ key: 'games', label: 'Games' },
		{ key: 'installations', label: 'Interactive installations' },
		{ key: 'xr', label: 'XR / VR / AR' },
		{ key: 'rnd', label: 'Research & development' }
	];
	var work = projects.slice().sort(function (a, b) { return (+a.getAttribute('data-order') || 99) - (+b.getAttribute('data-order') || 99); });

	// Project details: the full video, the facts and any longer notes, with
	// previous and next to move through the selected work in order.
	var cased = document.querySelector('.case');
	var caseVideo = cased.querySelector('video');
	var caseAt = 0;
	function fillCase(i) {
		caseAt = (i + work.length) % work.length;
		var s = work[caseAt];
		cased.querySelector('.case-kicker').textContent = text(s, '.exhibit-info .eyebrow');
		cased.querySelector('#case-title').textContent = text(s, 'h2');
		cased.querySelector('.case-desc').textContent = text(s, '.exhibit-desc');
		var facts = s.querySelector('.facts');
		cased.querySelector('.case-facts').innerHTML = facts ? facts.innerHTML : '';
		var slot = cased.querySelector('.case-more-slot'), more = s.querySelector('.case-more');
		slot.innerHTML = more ? more.innerHTML : '';
		var full = s.getAttribute('data-full'), clip = s.getAttribute('data-video');
		caseVideo.onerror = function () { if (clip && caseVideo.getAttribute('src') !== clip) caseVideo.src = clip; };
		caseVideo.poster = s.getAttribute('data-poster') || '';
		caseVideo.src = full || clip;
		var ar = (s.getAttribute('data-ar') || '16/9').split('/');
		cased.querySelector('.case-media').style.aspectRatio = parseFloat(ar[0]) / parseFloat(ar[1]) < 1.2 ? '4 / 3' : '16 / 9';
		var prev = work[(caseAt - 1 + work.length) % work.length], next = work[(caseAt + 1) % work.length];
		cased.querySelector('.case-prev span').textContent = text(prev, 'h2');
		cased.querySelector('.case-next span').textContent = text(next, 'h2');
		cased.querySelector('.case-prev').setAttribute('aria-label', 'Previous project: ' + text(prev, 'h2'));
		cased.querySelector('.case-next').setAttribute('aria-label', 'Next project: ' + text(next, 'h2'));
		cased.querySelector('.case-goto').setAttribute('href', '#' + s.id);
		cased.scrollTop = 0;
	}
	function openCase(stop) {
		fillCase(work.indexOf(stop));
		showDialog(cased);
		cased.querySelector('.dlg-close').focus({ preventScroll: true });
	}
	cased.querySelector('.dlg-close').addEventListener('click', function () { hideDialog(cased); });
	cased.querySelector('.case-prev').addEventListener('click', function () { caseVideo.pause(); fillCase(caseAt - 1); });
	cased.querySelector('.case-next').addEventListener('click', function () { caseVideo.pause(); fillCase(caseAt + 1); });
	cased.querySelector('.case-goto').addEventListener('click', function (e) {
		e.preventDefault();
		var s = work[caseAt];
		hideDialog(cased); hideDialog(gallery);
		if (walk.goTo) walk.goTo(s); else s.scrollIntoView();
	});
	cased.addEventListener('close', function () { unload(caseVideo); dialogClosed(); });

	// Selected work: every project as a card, filtered by kind of work.
	var gallery = document.querySelector('.gallery');
	var grid = gallery.querySelector('.gallery-grid');
	var filters = gallery.querySelector('.filters');
	var PLAY = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path class="fill" d="M5 3.2v9.6c0 .4.5.7.8.4l7.2-4.8c.3-.2.3-.6 0-.8L5.8 2.8c-.3-.3-.8 0-.8.4z" /></svg>';
	var cards = work.map(function (s) {
		var li = document.createElement('li');
		li.setAttribute('data-category', s.getAttribute('data-category') || '');
		var a = document.createElement('a');
		a.className = 'card';
		a.href = '#' + s.id;
		a.innerHTML = '<span class="card-media"><img alt="" loading="lazy" decoding="async" /><span class="card-play">' + PLAY + '</span></span>' +
			'<p class="eyebrow"></p><h3></h3><p class="card-desc"></p>';
		a.querySelector('img').src = s.getAttribute('data-poster');
		a.querySelector('.eyebrow').textContent = text(s, '.exhibit-info .eyebrow');
		a.querySelector('h3').textContent = text(s, 'h2');
		a.querySelector('.card-desc').textContent = text(s, '.exhibit-desc');
		a.addEventListener('click', function (e) { e.preventDefault(); openCase(s); });
		li.appendChild(a);
		grid.appendChild(li);
		return li;
	});
	CATS.forEach(function (c) {
		var n = c.key ? cards.filter(function (li) { return li.getAttribute('data-category').split(' ').indexOf(c.key) >= 0; }).length : cards.length;
		if (!n) return;
		var b = document.createElement('button');
		b.type = 'button';
		b.setAttribute('aria-pressed', c.key ? 'false' : 'true');
		b.innerHTML = c.label + '<sup>' + n + '</sup>';
		b.addEventListener('click', function () {
			[].forEach.call(filters.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
			cards.forEach(function (li) { li.hidden = !!c.key && li.getAttribute('data-category').split(' ').indexOf(c.key) < 0; });
		});
		filters.appendChild(b);
	});
	function openGallery() {
		showDialog(gallery);
		gallery.querySelector('.dlg-close').focus({ preventScroll: true });
	}
	gallery.querySelector('.dlg-close').addEventListener('click', function () { hideDialog(gallery); });
	gallery.addEventListener('close', dialogClosed);
	[].forEach.call(document.querySelectorAll('.js-work'), function (a) {
		a.addEventListener('click', function (e) { e.preventDefault(); openGallery(); });
	});
	if (location.hash === '#work') setTimeout(openGallery, 0);

	// every exhibit: the play buttons open the full video, Project details opens the case
	projects.forEach(function (s) {
		[].forEach.call(s.querySelectorAll('.watch'), function (b) { b.addEventListener('click', function () { openPlayer(s); }); });
		var c = s.querySelector('.case-open');
		if (c) c.addEventListener('click', function () { openCase(s); });
	});

	if (!root.classList.contains('is-3d') || !window.THREE) { lite(); return; }

	/* ---------- Lite mode: a plain page with the clips inline ---------- */

	function lite() {
		root.classList.remove('is-3d');
		root.classList.add('is-lite');
		// one clip plays at a time, the one most in view; reduced motion keeps the posters still
		var shown = [], playing = null;
		function pick() {
			var best = null, bestR = 0.35;
			shown.forEach(function (v) { if (v._ratio > bestR) { bestR = v._ratio; best = v; } });
			if (best === playing) return;
			if (playing) playing.pause();
			playing = best;
			if (best) {
				if (!best.getAttribute('src')) best.src = best.getAttribute('data-src');
				best.play().catch(function () {});
			}
		}
		var io = !reduced && 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
			es.forEach(function (e) {
				var v = e.target._video;
				v._ratio = e.isIntersecting ? e.intersectionRatio : 0;
				if (shown.indexOf(v) < 0) shown.push(v);
			});
			pick();
		}, { threshold: [0, 0.35, 0.6, 0.85] }) : null;
		projects.forEach(function (s) {
			var fig = s.querySelector('.exhibit-media'), clip = s.getAttribute('data-video');
			if (!fig) return;
			fig.addEventListener('click', function (e) { if (!e.target.closest('button')) openPlayer(s); });
			if (!clip || !io) return;
			var v = document.createElement('video');
			v.muted = true; v.loop = true; v.playsInline = true;
			v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
			v.preload = 'none';
			v.setAttribute('data-src', clip);
			v.addEventListener('playing', function () { v.classList.add('is-on'); });
			fig.insertBefore(v, fig.querySelector('.exhibit-play'));
			fig._video = v;
			io.observe(fig);
		});
	}

	/* ---------- Setup ---------- */

	var mobile = matchMedia('(max-width: 999px)').matches;
	var coarse = matchMedia('(pointer: coarse)').matches;
	var fancy = !coarse && !!THREE.Reflector && !!THREE.EffectComposer && !/[?&]plain\b/.test(location.search);
	var S = 12;                       // distance between stops along the path
	var N = stops.length;
	var END = (N - 1) * S;

	// The path winds gently so the walk never feels like a corridor.
	function pathX(s) { return 2.2 * Math.sin(s * 0.045) + 0.8 * Math.sin(s * 0.11 + 1.3); }

	var host = document.getElementById('scene');
	var renderer;
	try {
		renderer = new THREE.WebGLRenderer({ antialias: !fancy && !coarse, powerPreference: 'high-performance' });
	} catch (e) { lite(); return; }
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.6));
	renderer.outputEncoding = THREE.sRGBEncoding;
	host.appendChild(renderer.domElement);

	var scene = new THREE.Scene();
	var bg = new THREE.Color(0x090d14);
	scene.background = bg;
	scene.fog = new THREE.Fog(0x090d14, 12, 36);
	var camera = new THREE.PerspectiveCamera(36, 1, 0.25, 140);

	var hemi = new THREE.HemisphereLight(0xffffff, 0x1a1a24, 0.5);
	scene.add(hemi);
	var key = new THREE.DirectionalLight(0xffffff, 0.65);
	key.position.set(3, 7, -6);
	scene.add(key);
	var fill = new THREE.DirectionalLight(0xffffff, 0.25);
	fill.position.set(-4, 3, 8);
	scene.add(fill);
	var stationLight = new THREE.PointLight(0xffffff, 0, 16, 2);
	scene.add(stationLight);

	// Post-processing: soft bloom so LEDs and screens glow like they do in a dark room.
	var composer = null, bloom = null;
	if (fancy) {
		try {
			composer = new THREE.EffectComposer(renderer);
			composer.addPass(new THREE.RenderPass(scene, camera));
			bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.8);
			composer.addPass(bloom);
			composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
		} catch (e) { composer = null; }
	}

	function C(hex) { return new THREE.Color(hex); }
	// the render is gamma corrected at the end, so a colour meant to show as is goes in linear
	function L(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
	// a project's own colour, taken partway down so each room stays dark around its footage
	function D(hex) { return C(hex).lerp(L(hex), 0.45); }

	// Per-stop mood: background/fog colour and the LED floor colour. Each
	// chapter gate has its own light, so the five chapters read apart.
	var MOOD = {
		intro:   { bg: L(0x0d131d), led: C(0xc4ece6) },
		gate:    { bg: L(0x0f141d), led: C(0xfff1de) },
		gate2017: { bg: L(0x10151e), led: C(0xf2cfae) },
		gate2020: { bg: L(0x0e1224), led: C(0x9aacff) },
		gate2022: { bg: L(0x16141a), led: C(0xf0c896) },
		gate2023: { bg: L(0x0a1a22), led: C(0x61d9cc) },
		gate2025: { bg: L(0x151126), led: C(0xc8a8ff) },
		gate2026: { bg: L(0x0b1826), led: C(0x9fdcff) },
		court:   { bg: D(0x1b0a33), led: C(0xff3fb4) },
		water:   { bg: D(0x06131c), led: C(0x9fe6ff) },
		forest:  { bg: D(0x07190f), led: C(0x58f08a) },
		tryon:   { bg: D(0x061719), led: C(0x3fe0e0) },
		bowling: { bg: D(0x050e28), led: C(0x4a86ff) },
		tennis:  { bg: D(0x06180f), led: C(0xd8ff4a) },
		shadow:  { bg: D(0x0e0d0c), led: C(0xf1e6d2) },
		fireworks: { bg: D(0x0a0618), led: C(0xff6ad5) },
		city:    { bg: D(0x041416), led: C(0x3ff0c8) },
		mr:      { bg: D(0x140d08), led: C(0xffb35c) },
		galaxy:  { bg: D(0x03060f), led: C(0x56b8ff) },
		anatomy: { bg: D(0x150c10), led: C(0xff7a85) },
		road:    { bg: D(0x0d2034), led: C(0xffa23a) },
		drift:   { bg: D(0x140b22), led: C(0xb27bff) },
		shooter: { bg: D(0x1c0b05), led: C(0xff5a1a) },
		about:   { bg: L(0x14131a), led: C(0xf3d6ba) },
		contact: { bg: L(0x0d131d), led: C(0xc4ece6) }
	};

	var kinds = stops.map(function (s) { return s.getAttribute('data-scene'); });
	function stopS(i) { return i * S; }
	function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
	function damp(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
	function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

	/* ---------- Pointer ---------- */

	var mouse = new THREE.Vector2(0, 0), mouseOn = 0, mouseSeen = false, mouseMoved = 0;
	var mouseFloor = new THREE.Vector3(), ray = new THREE.Raycaster();
	var floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
	var lastMouse = new THREE.Vector2();
	function setPointer(e) {
		var r = renderer.domElement.getBoundingClientRect();
		mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
		mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
		mouseMoved += lastMouse.distanceTo(mouse);
		lastMouse.copy(mouse);
		mouseSeen = true;
	}
	window.addEventListener('pointermove', setPointer, { passive: true });
	window.addEventListener('pointerdown', setPointer, { passive: true });

	/* ---------- LED floor (a mirror on desktop) ---------- */

	var MAX_STEPS = 18;
	var clock = 0;
	var floorUniforms = {
		uTime: { value: 0 },
		uSteps: { value: [] },
		uChar: { value: new THREE.Vector2() },
		uMouse: { value: new THREE.Vector2() },
		uMouseOn: { value: 0 },
		uWave: { value: new THREE.Vector4(0, 0, -99, 0) },  // xz centre, start time, strength
		uLed: { value: new THREE.Color(1, 1, 1) },
		uBg: { value: new THREE.Color(0, 0, 0) },
		uLife: { value: new THREE.Vector4() },    // court, water, forest, road
		uLife2: { value: new THREE.Vector4() },   // grid, tiles, grass, runway
		uAt: { value: [0, 1, 2, 3, 4, 5, 6, 7].map(function () { return new THREE.Vector2(); }) },
		uFogNear: { value: 12 },
		uFogFar: { value: 34 },
		uReflect: { value: fancy ? 1 : 0 },
		tDiffuse: { value: null },
		textureMatrix: { value: new THREE.Matrix4() },
		color: { value: new THREE.Color(0x777777) }
	};
	for (var i = 0; i < MAX_STEPS; i++) floorUniforms.uSteps.value.push(new THREE.Vector4(0, 0, -99, 0));
	var floorShader = {
		uniforms: floorUniforms,
		vertexShader: [
			'uniform mat4 textureMatrix;',
			'varying vec4 vUv; varying vec3 vW;',
			'void main(){',
			'  vUv = textureMatrix * vec4(position, 1.0);',
			'  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;',
			'  gl_Position = projectionMatrix * viewMatrix * w;',
			'}'
		].join('\n'),
		fragmentShader: [
			'#define MAX_STEPS ' + MAX_STEPS,
			'uniform float uTime; uniform vec4 uSteps[MAX_STEPS]; uniform vec2 uChar; uniform vec2 uMouse; uniform float uMouseOn; uniform vec4 uWave;',
			'uniform vec3 uLed; uniform vec3 uBg; uniform vec4 uLife; uniform vec4 uLife2; uniform vec2 uAt[8];',
			'uniform float uFogNear; uniform float uFogFar; uniform float uReflect; uniform sampler2D tDiffuse;',
			'varying vec4 vUv; varying vec3 vW;',
			'float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }',
			'float line(float d, float w){ return 1.0 - smoothstep(w*0.5, w*0.5 + 0.03, abs(d)); }',
			'float thin(float d, float w){ return 1.0 - smoothstep(w * 0.4, w, abs(d)); }',
			'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
			// x * x rather than pow(x, 2.0): pow of a negative number is undefined and turns black on some phones
			'float sq(float x){ return x * x; }',
			'vec3 refl(){',
			'  if (uReflect < 0.5) return vec3(0.0);',
			'  vec4 uv = vUv; float k = 0.006 * uv.w;',
			'  vec3 c = texture2DProj(tDiffuse, uv).rgb * 0.36;',
			'  c += texture2DProj(tDiffuse, uv + vec4( k, 0.0, 0.0, 0.0)).rgb * 0.16;',
			'  c += texture2DProj(tDiffuse, uv + vec4(-k, 0.0, 0.0, 0.0)).rgb * 0.16;',
			'  c += texture2DProj(tDiffuse, uv + vec4(0.0,  k*1.6, 0.0, 0.0)).rgb * 0.16;',
			'  c += texture2DProj(tDiffuse, uv + vec4(0.0, -k*1.6, 0.0, 0.0)).rgb * 0.16;',
			'  return pow(c, vec3(2.2));',
			'}',
			'void main(){',
			'  vec2 p = vW.xz;',
			'  float cell = 0.14;',
			'  vec2 cid = (floor(p / cell) + 0.5) * cell;',
			'  vec2 g = fract(p / cell) - 0.5;',
			'  float dotm = smoothstep(0.42, 0.2, length(g));',
			'  float e = 0.035;',
			'  vec3 col = vec3(0.0);',
			'  for (int i = 0; i < MAX_STEPS; i++) {',
			'    vec4 s = uSteps[i]; float age = uTime - s.z;',
			'    if (age < 0.0 || age > 4.5) continue;',
			'    float d = distance(cid, s.xy); float r = age * 1.7;',
			'    e += s.w * (exp(-sq((d - r) * 5.0)) * exp(-age * 1.0) + 0.9 * exp(-d * d * 22.0) * exp(-age * 2.2));',
			'  }',
			'  float dc = distance(cid, uChar);',
			'  e += 0.38 * exp(-dc * dc * 1.6);',
			'  float dm = distance(cid, uMouse);',
			'  e += uMouseOn * (0.85 * exp(-dm * dm * 2.6) + 0.25 * exp(-sq((dm - mod(uTime*1.2, 3.0)) * 4.0)) * exp(-dm*0.6));',
			// arriving at a project: a wave of light runs out across the floor from his feet
			'  float wa = uTime - uWave.z;',
			'  if (wa > 0.0 && wa < 3.2) {',
			'    float wd = distance(cid, uWave.xy), wr = wa * 7.5;',
			'    e += uWave.w * (exp(-sq((wd - wr) * 1.5)) * 1.3 + exp(-sq((wd - wr * 0.72) * 2.4)) * 0.45) * exp(-wa * 1.0) * smoothstep(0.2, 1.4, wd);',
			'  }',
			'  col += uLed * e;',
			'  vec3 glow = vec3(0.0), surf = vec3(0.0);',
			// court: the air hockey rink, long side across the view, its goals glowing in each team colour
			'  if (uLife.x > 0.001) {',
			'    vec2 q = cid - uAt[0];',
			'    float box = sdBox(q, vec2(1.75, 1.25));',
			'    float inside = step(box, 0.0);',
			'    float lines = line(box, 0.07) + (line(q.x, 0.05) + line(length(q) - 0.42, 0.05)',
			'      + line(length(q - vec2(-1.75, 0.0)) - 0.52, 0.05) + line(length(q - vec2(1.75, 0.0)) - 0.52, 0.05)) * inside;',
			'    float goals = (exp(-sq(q.x + 1.8) * 30.0) + exp(-sq(q.x - 1.8) * 30.0)) * step(abs(q.y), 0.45);',
			'    float ang = atan(q.y, q.x);',
			'    float burst = inside * (0.14 + 0.12 * step(0.0, sin(ang * 10.0 + uTime * 0.6)));',
			'    vec3 pink = vec3(1.0, 0.22, 0.7), blue = vec3(0.3, 0.55, 1.0);',
			'    vec3 team = mix(blue, pink, step(0.0, q.x));',
			'    col += uLife.x * (mix(blue, pink, smoothstep(-3.0, 3.0, q.x)) * burst + vec3(1.0, 0.88, 1.0) * min(lines, 1.0) * 0.85 + team * goals * 1.4);',
			'  }',
			'  if (uLife.y > 0.001) {',
			'    vec2 q = cid - uAt[1];',
			'    float fall = exp(-dot(q * vec2(0.25, 0.16), q * vec2(0.25, 0.16)));',
			'    float c = sin(cid.x * 3.1 + uTime * 0.9) + sin(cid.y * 4.3 - uTime * 1.1) + sin((cid.x + cid.y) * 2.3 + uTime * 0.6) + sin(length(q) * 3.0 - uTime * 1.4);',
			'    c = pow(max(0.5 + 0.125 * c, 0.0), 3.0);',
			'    col += uLife.y * fall * vec3(0.55, 0.85, 1.0) * c * 0.9;',
			'  }',
			'  if (uLife.z > 0.001) {',
			'    vec2 q = cid - uAt[2];',
			'    float fall = exp(-dot(q * vec2(0.22, 0.15), q * vec2(0.22, 0.15)));',
			'    float n = sin(cid.x * 1.7 + sin(cid.y * 2.3)) * sin(cid.y * 1.9 + sin(cid.x * 1.3) + uTime * 0.2);',
			'    col += uLife.z * fall * mix(vec3(0.05, 0.35, 0.15), vec3(0.3, 0.9, 0.4), 0.5 + 0.5 * n) * 0.5;',
			'  }',
			// road: a curving street with lane paint and passing headlights (Car Path Draw, drift)
			'  if (uLife.w > 0.001) {',
			'    vec2 q = p - uAt[3];',
			'    float fall = exp(-dot(q * vec2(0.15, 0.1), q * vec2(0.15, 0.1)));',
			'    float cx = sin(q.y * 0.3) * 1.3;',
			'    float d = abs(q.x - cx);',
			'    float road = 1.0 - smoothstep(1.3, 1.36, d);',
			'    float edge = thin(d - 1.2, 0.05);',
			'    float dash = thin(q.x - cx, 0.06) * step(0.5, fract(q.y * 0.5));',
			'    float lights = exp(-sq(fract(q.y * 0.05 + uTime * 0.16) - 0.5) * 1400.0) * road;',
			'    surf += uLife.w * fall * road * vec3(0.022, 0.022, 0.026);',
			'    glow += uLife.w * fall * (vec3(0.95, 0.93, 0.9) * edge * 0.5 + vec3(1.0, 0.72, 0.25) * dash * 0.75 + uLed * lights * 0.7);',
			'  }',
			// grid: a lit city plan with data running along its streets (Dubai Police, sci-fi, XR)
			'  if (uLife2.x > 0.001) {',
			'    vec2 q = p - uAt[4];',
			'    float fall = exp(-dot(q * vec2(0.13, 0.1), q * vec2(0.13, 0.1)));',
			'    vec2 g = abs(fract(q / 1.2 + 0.5) - 0.5) * 1.2;',
			'    vec2 ci = floor(q / 1.2 + 0.5);',
			'    float gx = thin(g.x, 0.03), gz = thin(g.y, 0.03);',
			'    float px = mod(uTime * 2.6 + hash(vec2(ci.y, 3.0)) * 30.0, 30.0) - 15.0;',
			'    float pz = mod(uTime * 2.0 + hash(vec2(ci.x, 7.0)) * 30.0, 30.0) - 15.0;',
			'    float pulse = gz * exp(-sq((q.x - px) * 1.3)) * step(0.5, hash(vec2(ci.y, 1.0)))',
			'                + gx * exp(-sq((q.y - pz) * 1.3)) * step(0.5, hash(vec2(ci.x, 2.0)));',
			'    float r = length(q);',
			'    float rings = thin(r - 1.5, 0.035) + thin(r - 2.4, 0.025) * step(0.0, sin(atan(q.y, q.x) * 18.0 + uTime * 0.8));',
			'    float scan = exp(-sq(r - mod(uTime * 2.4, 10.0)) * 5.0);',
			'    glow += uLife2.x * fall * uLed * (max(gx, gz) * (0.14 + scan * 0.8) + pulse * 1.2 + rings * 0.45);',
			'  }',
			// tiles: eight-point star inlay in warm gold (Madinat Jumeirah)
			'  if (uLife2.y > 0.001) {',
			'    vec2 q = p - uAt[5];',
			'    float fall = exp(-dot(q * vec2(0.14, 0.1), q * vec2(0.14, 0.1)));',
			'    vec2 l = (fract(q / 1.3 + 0.5) - 0.5) * 1.3;',
			'    vec2 lr = vec2(l.x + l.y, l.y - l.x) * 0.70710678;',
			'    float star = min(sdBox(l, vec2(0.36)), sdBox(lr, vec2(0.36)));',
			'    float oct = max(sdBox(l, vec2(0.17)), sdBox(lr, vec2(0.17)));',
			'    float tl = thin(star, 0.035) + thin(oct, 0.025) * 0.7 + thin(max(abs(l.x), abs(l.y)) - 0.65, 0.03) * 0.35;',
			'    float shimmer = 0.5 + 0.5 * sin(q.x * 0.6 + q.y * 0.45 - uTime * 1.2);',
			'    vec3 gold = vec3(1.0, 0.7, 0.32);',
			'    surf += uLife2.y * fall * (1.0 - step(0.0, star)) * vec3(0.035, 0.022, 0.01);',
			'    glow += uLife2.y * fall * gold * min(tl, 1.0) * (0.35 + 0.55 * shimmer);',
			'  }',
			// grass: mown stripes on a tennis lawn
			'  if (uLife2.z > 0.001) {',
			'    vec2 q = p - uAt[6];',
			'    float fall = exp(-dot(q * vec2(0.14, 0.09), q * vec2(0.14, 0.09)));',
			'    float stripe = step(0.5, fract(q.y / 1.7));',
			'    float n = hash(floor(p * 50.0));',
			'    surf += uLife2.z * fall * mix(vec3(0.03, 0.085, 0.03), vec3(0.055, 0.15, 0.05), stripe) * (0.85 + 0.3 * n);',
			'  }',
			// runway: a catwalk lit from both edges, with a pool of light at the wall (BOSS)
			'  if (uLife2.w > 0.001) {',
			'    vec2 q = p - uAt[7];',
			'    float span = step(-7.2, q.y) * step(q.y, 5.0);',
			'    float strip = (1.0 - smoothstep(0.95, 1.0, abs(q.x))) * span;',
			'    vec2 b = vec2(abs(q.x) - 1.1, (fract(q.y * 1.4) - 0.5) / 1.4);',
			'    float bulbs = exp(-dot(b, b) * 1600.0) * span;',
			'    float wave = exp(-sq(fract(q.y * 0.06 - uTime * 0.22) - 0.5) * 120.0);',
			'    vec2 pq = (q - vec2(0.0, -6.0)) * vec2(0.75, 1.2);',
			'    float pool = exp(-dot(pq, pq));',
			'    float fade = exp(-max(q.y, 0.0) * 0.25);',
			'    surf += uLife2.w * strip * vec3(0.05, 0.048, 0.045) * fade;',
			'    glow += uLife2.w * (vec3(1.0, 0.95, 0.86) * bulbs * (0.5 + 1.0 * wave) * 1.3 * fade + vec3(1.0, 0.96, 0.9) * pool * 0.3);',
			'  }',
			'  vec3 base = uBg * 1.1 + vec3(0.006);',
			'  vec3 V = normalize(cameraPosition - vW);',
			'  float fres = 0.18 + 0.5 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);',
			'  vec3 c3 = base + surf + col * dotm + col * 0.05 + glow + refl() * fres * (1.0 - dotm * 0.6);',
			'  float fog = smoothstep(uFogNear, uFogFar, distance(cameraPosition, vW));',
			'  gl_FragColor = vec4(mix(c3, uBg, fog), 1.0);',
			'  #include <encodings_fragment>',
			'}'
		].join('\n')
	};
	var floorGeo = new THREE.PlaneBufferGeometry(70, END + 80);
	var floor;
	if (fancy) {
		floor = new THREE.Reflector(floorGeo, {
			shader: floorShader,
			textureWidth: Math.round(innerWidth * 0.5),
			textureHeight: Math.round(innerHeight * 0.5),
			clipBias: 0.003
		});
	} else {
		floor = new THREE.Mesh(floorGeo, new THREE.ShaderMaterial(floorShader));
	}
	var floorU = floor.material.uniforms;
	var steps = floorU.uSteps.value;
	floor.rotation.x = -Math.PI / 2;
	floor.position.set(0, 0, END / 2);
	scene.add(floor);
	var stepIdx = 0;
	var FLOOR_KEYS = ['court', 'water', 'forest', 'road', 'grid', 'tiles', 'grass', 'runway'];
	var fLife = [], fW = [], fX = [], fZ = [];
	function addRipple(x, z, strength) {
		steps[stepIdx].set(x, z, clock, strength);
		stepIdx = (stepIdx + 1) % MAX_STEPS;
	}

	// Floating dust catches the light and gives the room depth.
	(function dust() {
		var n = coarse ? 300 : 900, pos = new Float32Array(n * 3);
		for (var i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 6; pos[i * 3 + 2] = Math.random() * (END + 30) - 15; }
		var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		var m = new THREE.PointsMaterial({ color: 0xffffff, size: 0.025, transparent: true, opacity: 0.35, depthWrite: false });
		scene.add(new THREE.Points(g, m));
	})();

	// Far backdrop: a soft horizon glow in each stop's colour, so the room
	// changes with the project instead of sitting in flat black.
	var skyU = { uBg: { value: new THREE.Color() }, uLed: { value: new THREE.Color() }, uTime: { value: 0 }, uWalk: { value: 0 } };
	var sky = new THREE.Mesh(new THREE.PlaneBufferGeometry(240, 64), new THREE.ShaderMaterial({
		uniforms: skyU, depthWrite: false,
		vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: [
			'uniform vec3 uBg; uniform vec3 uLed; uniform float uTime; uniform float uWalk; varying vec2 vUv;',
			'void main(){',
			'  float y = vUv.y * 64.0 - 2.0, x = (vUv.x - 0.5) * 240.0;',
			'  float band = exp(-max(y, 0.0) * 0.12);',
			'  float halo = exp(-(x * x * 0.0005 + (y - 4.0) * (y - 4.0) * 0.006));',
			// faint searchlights far off over the venue, swinging slowly as he walks
			'  float beams = 0.0;',
			'  for (int i = 0; i < 5; i++) {',
			'    float fi = float(i), ox = -64.0 + fi * 32.0 + sin(fi * 2.3) * 6.0;',
			'    float a = sin(uTime * 0.09 + uWalk * 0.04 + fi * 1.9) * 0.42;',
			'    vec2 q = vec2(x - ox, y + 2.0);',
			'    float d = abs(q.x * cos(a) - q.y * sin(a)), w = 0.5 + 0.07 * q.y;',
			'    beams += exp(-d * d / (w * w)) * exp(-q.y * 0.045) * step(0.0, q.x * sin(a) + q.y * cos(a));',
			'  }',
			'  gl_FragColor = vec4(uBg + uLed * (band * 0.08 + halo * 0.05 + beams * 0.03), 1.0);',
			'  #include <encodings_fragment>',
			'}'
		].join('\n')
	}));
	sky.renderOrder = -10;
	scene.add(sky);

	/* ---------- Burhan (3D avatar) ---------- */

	// A rigged character from the Dubai Police 360 VR project, re-dressed in a
	// charcoal overshirt, jeans and brown shoes, walking with a captured walk
	// cycle and presenting with a captured talking idle at each project.
	var HEIGHT = 1.82;
	var person = new THREE.Group();
	scene.add(person);
	var avatar = null, mixer = null, walkA = null, idleA = null, walkDur = 1, STRIDE = 1.83 * (HEIGHT / 1.68);
	var bones = {}, glasses = new THREE.Group();
	var pose = { move: 0, glasses: 0, yaw: 0, walkT: 0, lastHalf: 0 };

	function radialTex(inner, outer) {
		var c = document.createElement('canvas'); c.width = c.height = 128;
		var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
		gr.addColorStop(0, inner); gr.addColorStop(1, outer);
		g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
		return new THREE.CanvasTexture(c);
	}
	// soft contact shadow under the feet
	var shadow = new THREE.Mesh(new THREE.PlaneBufferGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
	shadow.rotation.x = -Math.PI / 2;
	scene.add(shadow);

	// rim light behind him, tinted by the scene, so he sits in the colour of each stop
	var rimLight = new THREE.SpotLight(0xffffff, 0, 9, 0.7, 0.6, 1.4);
	scene.add(rimLight); scene.add(rimLight.target);
	var faceLight = new THREE.PointLight(0xfff1e4, 0.7, 6, 2);
	scene.add(faceLight);
	// a soft key from the camera side, aimed only at him
	var avKey = new THREE.SpotLight(0xfff3e8, 1.3, 14, 0.32, 0.6, 1.2);
	scene.add(avKey); scene.add(avKey.target);
	[hemi, key, fill, rimLight, faceLight, avKey].forEach(function (l) { l.layers.enable(1); });

	(function loadAvatar() {
		if (!THREE.GLTFLoader) return;
		var L = new THREE.GLTFLoader(), got = {};
		function done() {
			if (!got.body || !got.walk || !got.idle) return;
			avatar = got.body.scene;
			avatar.scale.setScalar(HEIGHT / 1.68);
			avatar.traverse(function (o) {
				if (o.isBone) bones[o.name] = o;
				if (o.isMesh) {
					o.frustumCulled = false;
					o.layers.enable(1);
					var m = o.material;
					m.skinning = true; m.roughness = 0.72; m.metalness = 0.0; m.envMapIntensity = 0.6;
					m.needsUpdate = true;
				}
			});
			person.add(avatar);
			// keep him walking on the spot: the scroll moves him, not the clip
			var clip = got.walk.animations[0];
			clip.tracks.forEach(function (tr) {
				if (/Hips\.position$/.test(tr.name)) {
					var v = tr.values, x0 = v[0], z0 = v[2];
					for (var i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
				}
			});
			var idleClip = got.idle.animations[0];
			mixer = new THREE.AnimationMixer(avatar);
			walkA = mixer.clipAction(clip); walkA.play(); walkA.timeScale = 0;
			idleA = mixer.clipAction(idleClip); idleA.play();
			walkDur = clip.duration;
			// sunglasses for the try-on stop, on the head bone
			var head = bones['mixamorigHead'] || bones['mixamorig:Head'];
			if (head) {
				var lensM = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.08, metalness: 0.9 });
				var frameM = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.3 });
				[-1, 1].forEach(function (sd) {
					var lens = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.026, 0.026, 0.006, 24), lensM);
					lens.rotation.x = Math.PI / 2; lens.scale.set(1.25, 1, 1); lens.position.set(sd * 0.034, 0, 0); glasses.add(lens);
				});
				var bridge = new THREE.Mesh(new THREE.BoxBufferGeometry(0.02, 0.005, 0.005), frameM); glasses.add(bridge);
				var bar = new THREE.Mesh(new THREE.BoxBufferGeometry(0.15, 0.006, 0.006), frameM); bar.position.y = 0.022; glasses.add(bar);
				glasses.traverse(function (o) { o.layers.enable(1); });
				var hs = 1 / (avatar.scale.x * worldScaleOf(head));
				glasses.scale.setScalar(hs);
				glasses.position.set(0, 0.075 * hs, 0.085 * hs);
				glasses.visible = false;
				head.add(glasses);
			}
		}
		function worldScaleOf(o) { var v = new THREE.Vector3(); o.updateMatrixWorld(true); o.getWorldScale(v); return v.x / (HEIGHT / 1.68); }
		function fail(e) { console.error('Avatar failed to load', e); }
		L.load('media/avatar/burhan-avatar.glb', function (g) { got.body = g; done(); }, undefined, fail);
		L.load('media/avatar/walk.glb', function (g) { got.walk = g; done(); }, undefined, fail);
		L.load('media/avatar/idle.glb', function (g) { got.idle = g; done(); }, undefined, fail);
	})();

	var _hand = new THREE.Vector3();
	function handWorld(out) {
		var b = bones['mixamorigRightHand'] || bones['mixamorig:RightHand'];
		if (b) return b.getWorldPosition(out);
		return out.set(person.position.x + 0.3, 1.0, person.position.z);
	}
	function roundRect(g, x, y, w, h, r) {
		g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
		g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
	}

	// a small camera that films him for the try-on kiosk's mirror
	var mirrorRT = new THREE.WebGLRenderTarget(256, 448);
	mirrorRT.texture.encoding = THREE.sRGBEncoding;
	var mirrorCam = new THREE.PerspectiveCamera(24, 256 / 448, 0.1, 10);
	mirrorCam.layers.set(1);
	var mirrorWanted = false;

	/* ---------- Helpers ---------- */

	// glTF models from the Dubai Police 360 VR project, loaded the first time
	// their stop comes into view.
	var modelCache = {};
	function loadModel(url, cb) {
		if (!THREE.GLTFLoader) return;
		if (modelCache[url]) { modelCache[url].push(cb); return; }
		modelCache[url] = [cb];
		new THREE.GLTFLoader().load(url, function (g) {
			g.scene.traverse(function (o) { if (o.isMesh) { o.frustumCulled = false; if (o.material) { o.material.envMapIntensity = 0.5; } } });
			var cbs = modelCache[url]; modelCache[url] = { push: function (f) { f(g.scene.clone()); } };
			cbs.forEach(function (f, i) { f(i ? g.scene.clone() : g.scene); });
		}, undefined, function (e) { console.error('Model failed to load: ' + url, e); });
	}

	function textTex(w, h) {
		var c = document.createElement('canvas'); c.width = w; c.height = h;
		var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
		return { c: c, g: c.getContext('2d'), t: t };
	}
	// canvas text is drawn now and again once the display font has loaded
	var fontWaiters = [];
	function onFont(draw) { draw(); if (fontWaiters) fontWaiters.push(draw); }
	if (document.fonts && document.fonts.load) {
		Promise.all([document.fonts.load('500 64px "Space Grotesk"'), document.fonts.load('700 64px "Space Grotesk"')]).then(function () {
			var w = fontWaiters; fontWaiters = null;
			w.forEach(function (f) { f(); });
		}).catch(function () {});
	}
	var glowTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
	function std(color, opts) {
		var o = { color: color, roughness: 0.55, metalness: 0.1 };
		for (var k in opts) o[k] = opts[k];
		return new THREE.MeshStandardMaterial(o);
	}
	// A fine pixel grid laid over each screen, so footage reads as an LED wall.
	var ledGrid = (function () {
		var c = document.createElement('canvas'); c.width = c.height = 8;
		var g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 8, 8);
		g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 7, 8, 1); g.fillRect(7, 0, 1, 8);
		var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter;
		return t;
	})();

	/* ---------- Screens ---------- */

	var screens = [];
	var loader = new THREE.TextureLoader();
	function makeScreen(stop, i, opts) {
		var ar = (stop.getAttribute('data-ar') || '16/9').split('/');
		ar = parseFloat(ar[0]) / parseFloat(ar[1]);
		var h = opts.h || 2.8, w = h * ar;
		if (w > (opts.maxW || 5.2)) { w = opts.maxW || 5.2; h = w / ar; }
		var poster = loader.load(stop.getAttribute('data-poster'));
		poster.encoding = THREE.sRGBEncoding; poster.minFilter = THREE.LinearFilter; poster.generateMipmaps = false;
		// pulled forward in depth so the frame behind it never shows through (the bloom pass has a 16-bit depth buffer)
		var mat = new THREE.MeshBasicMaterial({ map: poster, color: 0x222222, fog: false, side: opts.side || THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
		var mesh, holder = new THREE.Group();
		if (opts.geometry) { mesh = new THREE.Mesh(opts.geometry, mat); holder.add(mesh); }
		else {
			mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(w, h), mat);
			holder.add(mesh);
			var gridTex = ledGrid.clone(); gridTex.needsUpdate = true; gridTex.repeat.set(w * 26, h * 26);
			var grid = new THREE.Mesh(new THREE.PlaneBufferGeometry(w, h), new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, depthWrite: false, fog: false }));
			grid.position.z = 0.004; holder.add(grid);
			var frame = new THREE.Mesh(new THREE.BoxBufferGeometry(w + 0.1, h + 0.1, 0.12), std(0x0b0b0d, { roughness: 0.35, metalness: 0.5 }));
			frame.position.z = -0.1; holder.add(frame);
			[-w / 2 + 0.25, w / 2 - 0.25].forEach(function (x) {
				var leg = new THREE.Mesh(new THREE.BoxBufferGeometry(0.08, 6, 0.08), std(0x141418, { metalness: 0.6, roughness: 0.4 }));
				leg.position.set(x, -h / 2 - 3, -0.15); holder.add(leg);
			});
			var glow = new THREE.Mesh(new THREE.PlaneBufferGeometry(w * 2.2, h * 2.6), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
			glow.position.z = -0.25; holder.add(glow);
			holder.userData.glow = glow;
		}
		holder.userData.h = h; holder.userData.w = w;
		mesh.userData.stop = stop;
		mesh.userData.index = i;
		var video = null, vtex = null, state = 0;
		holder.userData.update = function (life, led) {
			var b = 0.08 + 0.92 * life;
			mat.color.setRGB(b, b, b);
			if (holder.userData.glow) holder.userData.glow.material.color.copy(led).multiplyScalar(0.22 * life);
			if (life > 0.12 && state === 0) {
				state = 1;
				video = document.createElement('video');
				video.muted = true; video.loop = true; video.playsInline = true; video.setAttribute('playsinline', '');
				video.preload = 'auto';
				video.src = stop.getAttribute('data-video');
				video.addEventListener('playing', function () {
					if (vtex) return;
					vtex = new THREE.VideoTexture(video);
					vtex.encoding = THREE.sRGBEncoding; vtex.minFilter = THREE.LinearFilter; vtex.generateMipmaps = false;
					if (opts.flipX) { vtex.repeat.x = -1; vtex.offset.x = 1; }
					mat.map = vtex; mat.needsUpdate = true;
				});
			}
			if (video) {
				if (life > 0.12 && video.paused) video.play().catch(function () {});
				else if (life < 0.04 && !video.paused) video.pause();
			}
		};
		if (opts.flipX) { poster.repeat.x = -1; poster.offset.x = 1; }
		screens.push(mesh);
		return holder;
	}

	/* ---------- Stops ---------- */

	var stations = [];

	// Each stop sits on the path. Local -z is behind Burhan (further from the
	// camera); everything that rises stays behind him so he is never walking
	// through it.
	//
	// The project's video plays on a monitor standing on the floor to his right,
	// in front of the scene, so it never hides the 3D build behind him. On a
	// phone there is no room beside him, so it becomes a big screen at the very
	// back, behind everything else in the scene.
	function station(i, kind, stop) {
		var s0 = stopS(i);
		var grp = new THREE.Group();
		grp.position.set(pathX(s0), 0, s0);
		scene.add(grp);
		var st = { i: i, kind: kind, s: s0, group: grp, life: 0, rise: true, update: function () {} };
		var year = stop.getAttribute('data-gate-year');
		st.mood = MOOD[kind + (year || '')] || MOOD[kind] || MOOD.intro;
		var hasVideo = !!stop.getAttribute('data-video');
		if (hasVideo && kind !== 'forest') {
			var ar = (stop.getAttribute('data-ar') || '16/9').split('/');
			ar = parseFloat(ar[0]) / parseFloat(ar[1]);
			var scr = makeScreen(stop, i, { h: ar < 1.2 ? 1.85 : 1.3, maxW: 2.35 });
			var sw = scr.userData.w, sh = scr.userData.h;
			scr.userData.base = new THREE.Vector3(0.95 + sw / 2, 0.14 + sh / 2, -2.2);
			scr.userData.rotD = -0.2;
			scr.userData.mScale = Math.min(8.8 / sw, 5.4 / sh);
			scr.userData.baseM = new THREE.Vector3(0.15, 3.3 + sh * scr.userData.mScale / 2, -21);
			grp.add(scr);
			st.screen = scr;
		}
		var B = kind === 'gate' && year === '2017' ? BUILD.portal : BUILD[kind];
		if (B) B(st, grp, stop);
		stations.push(st);
		return st;
	}

	var BUILD = {};

	BUILD.intro = function (st, grp) {
		st.rise = false;
		var ring = new THREE.Mesh(new THREE.RingBufferGeometry(1.0, 1.035, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false }));
		ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01;
		scene.add(ring);
		var spot = new THREE.Mesh(new THREE.CircleBufferGeometry(1.8, 64), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x9a9aa6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
		spot.rotation.x = -Math.PI / 2; spot.position.y = 0.008;
		scene.add(spot);
		st.update = function (t, life) {
			ring.material.opacity = 0.18 * life * (0.6 + 0.4 * Math.sin(t * 2));
			ring.position.set(person.position.x, 0.01, person.position.z);
			spot.position.set(person.position.x, 0.008, person.position.z);
			spot.material.opacity = life * 0.4;
			var sc = 1 + 0.05 * Math.sin(t * 2); ring.scale.set(sc, sc, sc);
		};
	};

	// Chapter gate: a slim frame of light across the path in the chapter's
	// colour, its name above it and the year written into the floor behind.
	BUILD.gate = function (st, grp, stop) {
		st.rise = false;
		var year = stop.getAttribute('data-gate-year'), label = stop.getAttribute('data-gate-label') || '';
		var col = st.mood.led.clone().lerp(new THREE.Color(1, 1, 1), 0.3), css = '#' + col.getHexString();
		var W = 3.8, H = 3.0, T = 0.05;
		var barMat = new THREE.MeshBasicMaterial({ color: col.clone() });
		var gate = new THREE.Group();
		gate.position.z = -2.2;
		[[-W / 2, H / 2, T, H], [W / 2, H / 2, T, H], [0, H, W + T, T]].forEach(function (b) {
			var m = new THREE.Mesh(new THREE.BoxBufferGeometry(b[2], b[3], T), barMat);
			m.position.set(b[0], b[1], 0); gate.add(m);
		});
		var lbl = textTex(1024, 128), yt = textTex(1024, 400);
		onFont(function () {
			var g = lbl.g; g.clearRect(0, 0, 1024, 128);
			g.fillStyle = css; g.textAlign = 'center'; g.textBaseline = 'middle';
			if ('letterSpacing' in g) g.letterSpacing = '9px';
			var txt = (year + '  ·  ' + label).toUpperCase();
			g.font = '500 52px "Space Grotesk", Arial, sans-serif';
			g.font = '500 ' + Math.min(52, Math.floor(52 * 960 / g.measureText(txt).width)) + 'px "Space Grotesk", Arial, sans-serif';
			g.fillText(txt, 512, 66); lbl.t.needsUpdate = true;
			var y = yt.g; y.clearRect(0, 0, 1024, 400);
			y.fillStyle = '#fff'; y.font = '500 330px "Space Grotesk", Arial, sans-serif'; y.textAlign = 'center'; y.textBaseline = 'middle';
			y.fillText(year, 512, 214); yt.t.needsUpdate = true;
		});
		var plate = new THREE.Mesh(new THREE.PlaneBufferGeometry(3.6, 0.45), new THREE.MeshBasicMaterial({ map: lbl.t, transparent: true, depthWrite: false }));
		plate.position.set(0, H + 0.34, 0); gate.add(plate);
		grp.add(gate);
		var floorYear = new THREE.Mesh(new THREE.PlaneBufferGeometry(6.4, 2.5), new THREE.MeshBasicMaterial({ map: yt.t, color: col.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
		floorYear.rotation.x = -Math.PI / 2;
		floorYear.position.set(0.2, 0.012, -4.9);
		grp.add(floorYear);
		st.update = function (t, life) {
			var k = smooth(0, 0.6, life);
			gate.scale.set(1, Math.max(0.001, easeOut(k)), 1);
			gate.visible = k > 0.003;
			barMat.color.copy(col).multiplyScalar(0.4 + 0.9 * k);
			plate.material.opacity = smooth(0.4, 0.9, life);
			floorYear.material.opacity = 0.5 * smooth(0.3, 1, life);
		};
	};

	// 2017, the portal: a tall lit doorway where the walk begins, a dusk sky
	// over the city glowing inside it. The opening shot looks past Burhan at
	// it; he walks up to it and steps out through it into the first chapter.
	var heroPortal = new THREE.Vector3(0, 2, 10);
	BUILD.portal = function (st, grp) {
		st.rise = false; st.portal = true;
		var W = 2.6, H = 5.0, Z = -2.2;
		var P = new THREE.Group(); P.position.z = Z; grp.add(P);
		heroPortal.set(grp.position.x, H * 0.45, grp.position.z + Z);

		var sky = textTex(256, 512), g = sky.g;
		var gr = g.createLinearGradient(0, 0, 0, 512);
		gr.addColorStop(0, '#0e2333'); gr.addColorStop(0.3, '#285f6c'); gr.addColorStop(0.58, '#a3d9d1');
		gr.addColorStop(0.76, '#f1d8bd'); gr.addColorStop(0.88, '#f0b98f'); gr.addColorStop(1, '#fff0df');
		g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
		var hz = g.createRadialGradient(128, 440, 0, 128, 440, 210);
		hz.addColorStop(0, 'rgba(255,246,232,0.85)'); hz.addColorStop(1, 'rgba(255,246,232,0)');
		g.fillStyle = hz; g.fillRect(0, 0, 256, 512);
		// a low skyline against the glow, one tower rising over the rest
		var seed = 11;
		function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
		g.fillStyle = 'rgba(16,30,44,0.78)';
		for (var x = -4; x < 260;) { var bw = 7 + rnd() * 15, bh = 14 + rnd() * 52; g.fillRect(x, 468 - bh, bw + 0.5, bh + 44); x += bw; }
		g.fillRect(166, 318, 9, 194); g.fillRect(162.5, 360, 16, 152); g.fillRect(158, 404, 25, 108); g.fillRect(169.5, 262, 2, 58);
		g.fillStyle = 'rgba(255,214,170,0.55)';
		for (var j = 0; j < 70; j++) g.fillRect(Math.floor(rnd() * 256), 430 + Math.floor(rnd() * 70), 1.5, 1.5);
		sky.t.needsUpdate = true;
		var lightMat = new THREE.MeshBasicMaterial({ map: sky.t, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false, depthWrite: false });
		var light = new THREE.Mesh(new THREE.PlaneBufferGeometry(W, H), lightMat);
		light.position.y = H / 2; P.add(light);

		var edgeCol = new THREE.Color(0.8, 1.0, 0.96), edgeMat = new THREE.MeshBasicMaterial({ color: edgeCol.clone(), fog: false });
		[[-W / 2, H / 2, 0.035, H], [W / 2, H / 2, 0.035, H], [0, H, W + 0.035, 0.035], [0, 0.006, W, 0.012]].forEach(function (b) {
			var m = new THREE.Mesh(new THREE.BoxBufferGeometry(b[2], b[3], 0.035), edgeMat);
			m.position.set(b[0], b[1], 0); P.add(m);
		});
		// the stone around the opening, and a slab standing further off (none on the side the camera swings through)
		var stone = std(0x121a24, { roughness: 0.45, metalness: 0.6 });
		[-1, 1].forEach(function (sd) {
			var p = new THREE.Mesh(new THREE.BoxBufferGeometry(0.6, H + 0.6, 0.8), stone);
			p.position.set(sd * (W / 2 + 0.3), (H + 0.6) / 2, 0); P.add(p);
		});
		var lintel = new THREE.Mesh(new THREE.BoxBufferGeometry(W + 1.2, 0.6, 0.8), stone);
		lintel.position.set(0, H + 0.3, 0); P.add(lintel);
		[[5.0, 3.4, -0.35, 7.4]].forEach(function (m) {
			var slab = new THREE.Mesh(new THREE.BoxBufferGeometry(1.0, m[3], 0.4), stone);
			slab.position.set(m[0], m[3] / 2, m[1]); slab.rotation.y = m[2]; P.add(slab);
		});
		// light spilling onto the floor, mostly on the side he approaches from
		var poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
		var pool = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), poolMat);
		pool.rotation.x = -Math.PI / 2; pool.scale.set(4.4, 11, 1); pool.position.set(0, 0.014, -3.2); P.add(pool);
		var pool2 = new THREE.Mesh(new THREE.PlaneBufferGeometry(1, 1), poolMat);
		pool2.rotation.x = -Math.PI / 2; pool2.scale.set(3.4, 3.6, 1); pool2.position.set(0, 0.013, 1.2); P.add(pool2);
		var lamp = new THREE.PointLight(0xffe7d0, 0, 13, 2);
		lamp.position.set(0, 2.4, -0.9); P.add(lamp);
		lamp.layers.enable(1);
		st.update = function (t, life) {
			var k = smooth(0, 0.7, life);
			P.visible = k > 0.003;
			lightMat.opacity = 0.95 * k;
			lightMat.color.setScalar(0.9 + 0.25 * k + 0.03 * Math.sin(t * 0.7));
			edgeMat.color.copy(edgeCol).multiplyScalar(0.3 + 1.3 * k);
			poolMat.color.setRGB(0.95, 0.76, 0.58).multiplyScalar(0.42 * k);
			lamp.intensity = 1.7 * k;
		};
	};

	// Qadsiah: the festival's air hockey floor. Two players, drawn as columns of
	// light, knock the puck round the rink behind him and the board keeps score.
	BUILD.court = function (st, grp) {
		// the rink sits between him and the text; on a phone, behind him
		var C = [-2.1, -2.4], CM = [0.15, -3.6], A = 1.75, B = 1.25, GOAL = 0.45, PR = 0.13, MR = 0.26;
		st.floorKey = 'court'; st.floorAt = C.slice();
		var rink = new THREE.Group(); rink.position.set(C[0], 0, C[1]); grp.add(rink);
		var TEAM = [new THREE.Color(0x4d8cff), new THREE.Color(0xff3fb4)];
		function flat(size, color) {
			var m = new THREE.Mesh(new THREE.PlaneBufferGeometry(size, size), new THREE.MeshBasicMaterial({ map: glowTex, color: color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
			m.rotation.x = -Math.PI / 2; m.position.y = 0.02; rink.add(m); return m;
		}
		var fade = textTex(4, 128), fg = fade.g.createLinearGradient(0, 0, 0, 128);
		fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(1, 'rgba(255,255,255,1)');
		fade.g.fillStyle = fg; fade.g.fillRect(0, 0, 4, 128); fade.t.needsUpdate = true;
		var mallets = [0, 1].map(function (k) {
			var g = new THREE.Group(); rink.add(g);
			var ring = new THREE.Mesh(new THREE.TorusBufferGeometry(MR, 0.045, 10, 40), new THREE.MeshBasicMaterial({ color: TEAM[k].clone().multiplyScalar(1.5) }));
			ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
			var beam = new THREE.Mesh(new THREE.CylinderBufferGeometry(MR * 0.8, MR, 1.15, 28, 1, true), new THREE.MeshBasicMaterial({ map: fade.t, color: TEAM[k], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
			beam.position.y = 0.575; g.add(beam);
			var s = k ? 1 : -1;
			return { g: g, beam: beam, glow: flat(1.7, TEAM[k]), goal: flat(2.2, TEAM[k]), s: s, u: s * (A - 0.6), v: 0, vu: 0, vv: 0, aim: 0, seen: 0, look: 0 };
		});
		mallets.forEach(function (m) { m.goal.position.set(m.s * A, 0.02, 0); });
		var puck = new THREE.Mesh(new THREE.CylinderBufferGeometry(PR, PR, 0.05, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 1.55) }));
		puck.position.y = 0.03; rink.add(puck);
		var puckGlow = flat(1.5, 0xff8ae0);
		// the puck's streak, and sparks off every hit
		var TN = 26, trP = new Float32Array(TN * 3), trC = new Float32Array(TN * 3);
		var trGeo = new THREE.BufferGeometry();
		trGeo.setAttribute('position', new THREE.BufferAttribute(trP, 3)); trGeo.setAttribute('color', new THREE.BufferAttribute(trC, 3));
		var trail = new THREE.Points(trGeo, new THREE.PointsMaterial({ size: 0.34, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
		trail.frustumCulled = false; rink.add(trail);
		var SN = 48, spP = new Float32Array(SN * 3), spC = new Float32Array(SN * 3), spV = new Float32Array(SN * 3), spA = new Float32Array(SN).fill(9), spK = new Float32Array(SN * 3), spI = 0;
		var spGeo = new THREE.BufferGeometry();
		spGeo.setAttribute('position', new THREE.BufferAttribute(spP, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spC, 3));
		var sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.12, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
		sparks.frustumCulled = false; rink.add(sparks);
		// the scoreboard hangs over the far side of the rink
		var score = textTex(512, 256), pts = [0, 0];
		var board = new THREE.Mesh(new THREE.PlaneBufferGeometry(1.7, 0.85), new THREE.MeshBasicMaterial({ map: score.t, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
		grp.add(board);
		function drawScore() {
			var g = score.g; g.clearRect(0, 0, 512, 256);
			g.textAlign = 'center'; g.textBaseline = 'middle';
			g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = '600 30px "Space Grotesk", Arial, sans-serif'; g.fillText('AIR HOCKEY', 256, 30);
			g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(40, 58, 432, 2);
			g.font = '700 150px "Space Grotesk", Arial, sans-serif';
			g.fillStyle = '#7aa6ff'; g.fillText(String(pts[0]), 150, 160);
			g.fillStyle = '#ff6ccb'; g.fillText(String(pts[1]), 362, 160);
			g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(250, 132, 12, 12); g.fillRect(250, 176, 12, 12);
			score.t.needsUpdate = true;
		}
		onFont(drawScore);

		var P = { u: 0, v: 0, vu: -2.6, vv: 1.2 }, serveAt = 0, goalT = -9, goalK = 0, fxT = 0;
		function burst(u, v, col, n, sp) {
			for (var j = 0; j < n; j++) {
				var k = spI; spI = (spI + 1) % SN;
				var a = Math.random() * 6.283, s = sp * (0.4 + Math.random());
				spP[k * 3] = u; spP[k * 3 + 1] = 0.06; spP[k * 3 + 2] = v;
				spV[k * 3] = Math.cos(a) * s; spV[k * 3 + 1] = 0.8 + Math.random() * 1.6; spV[k * 3 + 2] = Math.sin(a) * s;
				spA[k] = 0; spK[k * 3] = col.r; spK[k * 3 + 1] = col.g; spK[k * 3 + 2] = col.b;
			}
		}
		var WHITE = new THREE.Color(1, 0.85, 0.97);
		function hitFx(u, v, col, s, t) {
			if (t - fxT < 0.06) return; fxT = t;
			burst(u, v, col, 6, 1.6);
			addRipple(grp.position.x + rink.position.x + u, grp.position.z + rink.position.z + v, s);
		}
		function goal(k, t) {
			pts[k] = (pts[k] + 1) % 10; drawScore();
			goalT = t; goalK = k;
			var gu = (k ? -1 : 1) * A;
			burst(gu, 0, TEAM[k], 22, 2.6);
			addRipple(grp.position.x + rink.position.x + gu, grp.position.z + rink.position.z, 1.6);
			P.u = 0; P.v = 0; P.vu = P.vv = 0; serveAt = t + 1.1;
			for (var j = 0; j < TN; j++) { trP[j * 3] = 0; trP[j * 3 + 2] = 0; }
		}
		function physics(h, t) {
			if (serveAt && t > serveAt) { serveAt = 0; P.vu = (goalK ? 1 : -1) * (1.8 + Math.random()); P.vv = (Math.random() - 0.5) * 2.4; }
			mallets.forEach(function (m) {
				var s = m.s, tu, tv, speed;
				// each player reacts a beat late and guesses a little wrong, so goals do happen
				m.look -= h;
				if (m.look <= 0) { m.look = 0.2 + Math.random() * 0.15; m.seen = P.v + (Math.random() - 0.5) * 1.1; m.aim = (Math.random() - 0.5) * 0.5; }
				if (serveAt) { tu = s * (A - 0.6); tv = 0; speed = 2; }
				else if (P.u * s > -0.1 && (P.vu * s < 1.0 || P.u * s > A - 0.7)) {
					// line up behind the puck and shoot it at the other goal
					var gu = P.u + s * A, gv = P.v - m.aim, gl = Math.sqrt(gu * gu + gv * gv) || 1;
					tu = P.u + gu / gl * 0.2; tv = P.v + gv / gl * 0.2; speed = 3.6;
				}
				else { tu = s * (A - 0.45); tv = Math.max(-0.6, Math.min(0.6, m.seen * 0.7)); speed = 2.2; }
				tu = s * Math.max(0.25, Math.min(A - MR - 0.02, tu * s)); tv = Math.max(-(B - MR - 0.02), Math.min(B - MR - 0.02, tv));
				var du = tu - m.u, dv = tv - m.v, d = Math.sqrt(du * du + dv * dv), mx = speed * h;
				if (d > mx) { du *= mx / d; dv *= mx / d; }
				m.u += du; m.v += dv; m.vu = du / h; m.vv = dv / h;
				var pu = P.u - m.u, pv = P.v - m.v, pd = Math.sqrt(pu * pu + pv * pv), R = PR + MR;
				if (pd < R && pd > 1e-4) {
					var nu = pu / pd, nv = pv / pd;
					P.u = m.u + nu * R; P.v = m.v + nv * R;
					var rel = (P.vu - m.vu) * nu + (P.vv - m.vv) * nv;
					if (rel < 0) { P.vu -= 1.9 * rel * nu; P.vv -= 1.9 * rel * nv; hitFx(P.u, P.v, TEAM[m.s > 0 ? 1 : 0], 0.9, t); }
				}
			});
			if (serveAt) return;
			P.u += P.vu * h; P.v += P.vv * h;
			var f = Math.exp(-0.12 * h); P.vu *= f; P.vv *= f;
			var inMouth = Math.abs(P.v) < GOAL - PR * 0.5;
			if (Math.abs(P.u) > A - PR && inMouth) {
				if (Math.abs(P.u) > A + 0.25) goal(P.u > 0 ? 0 : 1, t);
			} else {
				if (Math.abs(P.v) > B - PR) { P.v = Math.sign(P.v) * (B - PR); P.vv = -P.vv * 0.92; hitFx(P.u, P.v, WHITE, 0.7, t); }
				if (Math.abs(P.u) > A - PR) { P.u = Math.sign(P.u) * (A - PR); P.vu = -P.vu * 0.92; hitFx(P.u, P.v, WHITE, 0.7, t); }
			}
			// lively, but never too fast to follow
			var sp = Math.sqrt(P.vu * P.vu + P.vv * P.vv);
			if (sp > 4.5) { P.vu *= 4.5 / sp; P.vv *= 4.5 / sp; }
			else if (sp < 0.9) { if (sp < 1e-3) { P.vu = 1; sp = 1; } P.vu *= 0.9 / sp; P.vv *= 0.9 / sp; }
		}
		st.update = function (t, life, dt) {
			var k = smooth(0.25, 0.7, life), on = smooth(0.5, 0.8, life);
			var cc = mobile ? CM : C;
			rink.position.set(cc[0], 0, cc[1]); st.floorAt[0] = cc[0]; st.floorAt[1] = cc[1];
			board.position.set(mobile ? -1.5 : -2.05, mobile ? 1.8 : 2.2, mobile ? -4.6 : -4.4);
			board.material.opacity = k;
			board.scale.setScalar(Math.max(0.001, k) * (1 + 0.14 * Math.exp(-(t - goalT) * 4)));
			if (on > 0) { var n = Math.min(30, Math.ceil(dt / 0.008)); for (var j = 0; j < n; j++) physics(dt / n, t); }
			var gk = Math.exp(-(t - goalT) * 2.2);
			mallets.forEach(function (m, i) {
				m.g.position.set(m.u, 0, m.v); m.g.scale.setScalar(Math.max(0.001, k));
				m.beam.material.opacity = 0.42 * k * (1 + (goalK === i ? gk * 1.5 : 0));
				m.glow.position.set(m.u, 0.02, m.v); m.glow.material.opacity = 0.55 * k;
				// the goal a team scores in lights up in its colour
				m.goal.material.opacity = 0.25 * k + (goalK === i ? 0 : gk * 1.2);
			});
			puck.visible = on > 0.01; puck.position.set(P.u, 0.03, P.v); puck.scale.setScalar(Math.max(0.001, on));
			puckGlow.position.set(P.u, 0.02, P.v); puckGlow.material.opacity = on;
			for (j = TN - 1; j > 0; j--) { trP[j * 3] = trP[j * 3 - 3]; trP[j * 3 + 1] = 0.04; trP[j * 3 + 2] = trP[j * 3 - 1]; }
			trP[0] = P.u; trP[1] = 0.04; trP[2] = P.v;
			for (j = 0; j < TN; j++) { var fj = on * Math.pow(1 - j / TN, 1.4) * 1.2; trC[j * 3] = fj; trC[j * 3 + 1] = fj * 0.4; trC[j * 3 + 2] = fj * 0.85; }
			trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true;
			for (j = 0; j < SN; j++) {
				spA[j] += dt;
				var a = spA[j], kf = a < 0.6 ? 1 - a / 0.6 : 0;
				if (kf > 0) {
					spV[j * 3 + 1] -= 6 * dt;
					spP[j * 3] += spV[j * 3] * dt; spP[j * 3 + 1] = Math.max(0.03, spP[j * 3 + 1] + spV[j * 3 + 1] * dt); spP[j * 3 + 2] += spV[j * 3 + 2] * dt;
				}
				spC[j * 3] = spK[j * 3] * kf; spC[j * 3 + 1] = spK[j * 3 + 1] * kf; spC[j * 3 + 2] = spK[j * 3 + 2] * kf;
			}
			spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
		};
	};

	// Loewe: Seph Li's ink as thousands of strands drifting over the floor. They
	// curl round his feet and round the pointer, and two whirlpools wander
	// through, drawing the ink up into spinning columns.
	BUILD.water = function (st, grp) {
		st.floorKey = 'water'; st.floorAt = [-0.6, -2.4];
		st.stepBoost = 1.7;
		var N = coarse ? 900 : 2000, X0 = -4.4, X1 = 2.2, Z0 = -5.6, Z1 = 1.2;
		var pos = new Float32Array(N * 3), col = new Float32Array(N * 3), lp = new Float32Array(N * 6), lc = new Float32Array(N * 6);
		var age = new Float32Array(N), span = new Float32Array(N);
		function spawn(i) {
			pos[i * 3] = X0 + Math.random() * (X1 - X0); pos[i * 3 + 1] = 0.03; pos[i * 3 + 2] = Z0 + Math.random() * (Z1 - Z0);
			age[i] = 0; span[i] = 3 + Math.random() * 4;
		}
		for (var i = 0; i < N; i++) { spawn(i); age[i] = Math.random() * span[i]; }
		var geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
		var dots = new THREE.Points(geo, new THREE.PointsMaterial({ size: coarse ? 0.09 : 0.07, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
		var lgeo = new THREE.BufferGeometry();
		lgeo.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lgeo.setAttribute('color', new THREE.BufferAttribute(lc, 3));
		var strands = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
		dots.frustumCulled = strands.frustumCulled = false;
		grp.add(dots); grp.add(strands);
		// his feet, two wandering whirlpools and the pointer
		var vort = [{ x: 0, z: 0, w: 0.9, core: 0.35, lift: 0 }, { x: 0, z: 0, w: 1.5, core: 0.3, lift: 1.5 }, { x: 0, z: 0, w: -1.3, core: 0.3, lift: 1.2 }, { x: 0, z: 0, w: 0, core: 0.4, lift: 0 }];
		var INK = new THREE.Color(0x0b3a66), HI = new THREE.Color(0xd8fbff), fu = 0, fw = 0;
		function field(x, z, t) {
			fu = 0.22 * Math.sin(z * 0.9 + t * 0.35) + 0.12 * Math.sin((x + z) * 1.7 - t * 0.5);
			fw = 0.22 * Math.cos(x * 0.8 - t * 0.3) + 0.12 * Math.cos((x - z) * 1.5 + t * 0.4);
			var y = 0.03, dead = false;
			for (var j = 0; j < 4; j++) {
				var v = vort[j]; if (!v.w) continue;
				var dx = x - v.x, dz = z - v.z, r2 = dx * dx + dz * dz, f = v.w / (r2 + v.core * v.core), pull = Math.abs(f) * 0.25;
				fu += -dz * f - dx * pull; fw += dx * f - dz * pull;
				if (v.lift) y += v.lift * Math.exp(-r2 / 0.36);
				if (r2 < 0.006) dead = true;
			}
			return dead ? -1 : y;
		}
		st.update = function (t, life, dt) {
			var k = smooth(0.15, 0.7, life);
			dots.visible = strands.visible = k > 0.01;
			if (!dots.visible) return;
			var h = Math.min(dt, 0.05);
			vort[0].x = person.position.x - grp.position.x; vort[0].z = person.position.z - grp.position.z;
			vort[1].x = -2.5 + Math.sin(t * 0.21) * 1.3; vort[1].z = -3.3 + Math.sin(t * 0.33 + 1) * 1.1;
			vort[2].x = 0.1 + Math.sin(t * 0.17 + 2) * 0.9; vort[2].z = -4.4 + Math.cos(t * 0.27) * 0.6;
			vort[3].x = mouseFloor.x - grp.position.x; vort[3].z = mouseFloor.z - grp.position.z; vort[3].w = coarse ? 0 : mouseOn * 1.3;
			for (var i = 0; i < N; i++) {
				var i3 = i * 3, i6 = i * 6;
				age[i] += h;
				var y = field(pos[i3], pos[i3 + 2], t);
				pos[i3] += fu * h; pos[i3 + 2] += fw * h;
				var x = pos[i3], z = pos[i3 + 2];
				if (y < 0 || age[i] > span[i] || x < X0 - 0.5 || x > X1 + 0.5 || z < Z0 - 0.5 || z > Z1 + 0.5) { spawn(i); y = 0.03; x = pos[i3]; z = pos[i3 + 2]; fu = fw = 0; }
				pos[i3 + 1] = y;
				// fast ink glows, slow ink sinks back to deep blue
				var s = Math.sqrt(fu * fu + fw * fw), b = Math.min(1, Math.max(0, (s - 0.12) / 1.4));
				var a = k * Math.min(1, age[i] * 2) * Math.min(1, (span[i] - age[i]) * 1.5);
				var r = (INK.r + (HI.r - INK.r) * b) * a, g = (INK.g + (HI.g - INK.g) * b) * a, bl = (INK.b + (HI.b - INK.b) * b) * a;
				col[i3] = r; col[i3 + 1] = g; col[i3 + 2] = bl;
				lp[i6] = x; lp[i6 + 1] = y; lp[i6 + 2] = z;
				lp[i6 + 3] = x - fu * 0.16; lp[i6 + 4] = y; lp[i6 + 5] = z - fw * 0.16;
				lc[i6] = r * 0.8; lc[i6 + 1] = g * 0.8; lc[i6 + 2] = bl * 0.8; lc[i6 + 3] = lc[i6 + 4] = lc[i6 + 5] = 0;
			}
			geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
			lgeo.attributes.position.needsUpdate = true; lgeo.attributes.color.needsUpdate = true;
		};
	};

	BUILD.forest = function (st, grp, stop) {
		st.floorKey = 'forest'; st.floorAt = [0.5, -4.0];
		// the clip plays on a curved LED wall, like the room itself
		var R = 9, TL = 0.62;
		var geo = new THREE.CylinderBufferGeometry(R, R, 3.2, 48, 1, true, Math.PI - TL / 2, TL);
		var wall = makeScreen(stop, st.i, { geometry: geo, side: THREE.BackSide, flipX: true });
		wall.userData.base = new THREE.Vector3(1.6, 1.3 + 1.6, -9.6 + R);
		wall.userData.h = 3.2;
		grp.add(wall);
		st.screen = wall;
		// low-poly trees in the style of the forest in the footage:
		// round canopies and stacked pines in a few greens
		var greens = [0x3fbf4f, 0x5ad35a, 0x2e9e46, 0x7ee06a], pines = [0x1f7a4a, 0x26905a, 0x186a40];
		var trunkMat = std(0x5a3b28, { flatShading: true, roughness: 0.9 });
		var leafMats = greens.map(function (c) { return std(c, { flatShading: true, roughness: 0.75 }); });
		var pineMats = pines.map(function (c) { return std(c, { flatShading: true, roughness: 0.75 }); });
		var trees = [];
		function roundTree() {
			var t = new THREE.Group(), h = 0.5 + Math.random() * 0.4;
			var trunk = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.05, 0.08, h, 6), trunkMat); trunk.position.y = h / 2; t.add(trunk);
			var n = 2 + Math.floor(Math.random() * 3);
			for (var k = 0; k < n; k++) {
				var r = 0.28 + Math.random() * 0.22;
				var b = new THREE.Mesh(new THREE.IcosahedronBufferGeometry(r, 1), leafMats[Math.floor(Math.random() * leafMats.length)]);
				b.position.set((Math.random() - 0.5) * 0.45, h + r * 0.6 + k * 0.18, (Math.random() - 0.5) * 0.35);
				t.add(b);
			}
			return t;
		}
		function pineTree() {
			var t = new THREE.Group(), h = 0.25;
			var trunk = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.04, 0.06, 0.3, 6), trunkMat); trunk.position.y = 0.15; t.add(trunk);
			var mat = pineMats[Math.floor(Math.random() * pineMats.length)], tiers = 3 + Math.floor(Math.random() * 2);
			for (var k = 0; k < tiers; k++) {
				var r = 0.42 - k * 0.08, ch = 0.5;
				var c = new THREE.Mesh(new THREE.ConeBufferGeometry(r, ch, 8), mat);
				c.position.y = h + ch / 2 + k * 0.28; t.add(c);
			}
			return t;
		}
		for (var i = 0; i < 26; i++) {
			var tr = Math.random() < 0.55 ? roundTree() : pineTree();
			var side = i % 2 ? 1 : -1;
			var x = side * (1.4 + Math.random() * 4.2), z = -3.8 - Math.random() * 5.2;
			if (side < 0 && Math.random() < 0.5) x -= 1.5;
			tr.position.set(x, 0, z);
			tr.rotation.y = Math.random() * Math.PI;
			var sc = 0.8 + Math.random() * 0.7;
			tr.userData.size = sc;
			tr.userData.delay = Math.random() * 0.5;
			tr.userData.sway = Math.random() * 6;
			tr.scale.setScalar(0.001);
			grp.add(tr); trees.push(tr);
		}
		// the white ball from the footage, drifting over the canopy
		var orb = new THREE.Mesh(new THREE.SphereBufferGeometry(0.1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
		grp.add(orb);
		st.update = function (time, life) {
			for (var i = 0; i < trees.length; i++) {
				var tr = trees[i], k = smooth(tr.userData.delay, tr.userData.delay + 0.45, life);
				var over = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.15 : 1;
				tr.scale.setScalar(Math.max(0.001, k * over * tr.userData.size));
				tr.visible = k > 0.002;
				tr.rotation.z = Math.sin(time * 0.9 + tr.userData.sway) * 0.025;
			}
			orb.position.set(1.0 + Math.sin(time * 0.6) * 2.5, 1.6 + Math.abs(Math.sin(time * 1.8)) * 0.8, -6.5 + Math.cos(time * 0.6) * 1.2);
			orb.visible = life > 0.4;
		};
	};

	BUILD.tryon = function (st, grp) {
		st.floorKey = 'grid'; st.floorAt = [0.4, -3.0];
		var kiosk = new THREE.Group();
		// the try-on kiosk stands on his left, clear of the video monitor on his right
		kiosk.position.set(-2.3, 0, -3.4);
		kiosk.scale.setScalar(1.2);
		grp.add(kiosk);
		var body = new THREE.Mesh(new THREE.BoxBufferGeometry(1.05, 1.75, 0.1), std(0x111214, { roughness: 0.35, metalness: 0.5 }));
		body.position.y = 1.35; kiosk.add(body);
		var stand = new THREE.Mesh(new THREE.BoxBufferGeometry(0.12, 0.5, 0.12), std(0x1a1b1e, { metalness: 0.6 })); stand.position.y = 0.25; kiosk.add(stand);
		var foot = new THREE.Mesh(new THREE.BoxBufferGeometry(0.6, 0.04, 0.4), std(0x1a1b1e, { metalness: 0.6 })); foot.position.y = 0.02; kiosk.add(foot);
		var mirrorTex = mirrorRT.texture;
		var bgm = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.95, 1.65), new THREE.MeshBasicMaterial({ color: 0x0d3b40, fog: false }));
		bgm.position.set(0, 1.35, 0.052); kiosk.add(bgm);
		var mirror = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.95, 1.65), new THREE.MeshBasicMaterial({ map: mirrorTex, transparent: true, fog: false }));
		mirror.scale.x = -1;
		mirror.position.set(0, 1.35, 0.055); kiosk.add(mirror);
		var ui = textTex(256, 444);
		onFont(function () {
			var g = ui.g; g.clearRect(0, 0, 256, 444); g.strokeStyle = '#3fe0e0'; g.lineWidth = 6; g.strokeRect(10, 10, 236, 424);
			g.fillStyle = 'rgba(63,224,224,0.9)'; g.fillRect(10, 10, 236, 8);
			g.font = '600 18px "Space Grotesk", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
			['Choose glasses', 'Take a photo'].forEach(function (l, i) {
				var x = 18 + i * 116; g.fillStyle = 'rgba(10,30,32,0.85)'; g.fillRect(x, 384, 104, 36);
				g.fillStyle = '#e8ffff'; g.fillText(l, x + 52, 402);
			});
			ui.t.needsUpdate = true;
		});
		var uiMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.95, 1.65), new THREE.MeshBasicMaterial({ map: ui.t, transparent: true, fog: false }));
		uiMesh.position.set(0, 1.35, 0.058); kiosk.add(uiMesh);
		st.update = function (t, life) {
			var on = smooth(0.25, 0.8, life);
			kiosk.position.y = -(1 - easeOut(smooth(0, 0.5, life))) * 2.4;
			kiosk.position.x = mobile ? -1.3 : -2.3; kiosk.position.z = mobile ? -4.4 : -3.4;
			kiosk.rotation.y = mobile ? 0.2 : 0.38;
			kiosk.visible = life > 0.01;
			pose.glasses = Math.max(pose.glasses, smooth(0.55, 0.95, life));
			bgm.material.color.setRGB(0.02 + 0.03 * on, 0.06 + 0.17 * on, 0.07 + 0.18 * on);
			mirror.material.opacity = on;
			uiMesh.material.opacity = on;
			if (on > 0.01) mirrorWanted = true;
		};
	};

	BUILD.bowling = function (st, grp) {
		var laneX = 1.1, pinZ = -8.2;
		var pinGeo = new THREE.LatheBufferGeometry([
			new THREE.Vector2(0.0, 0), new THREE.Vector2(0.05, 0.0), new THREE.Vector2(0.075, 0.08), new THREE.Vector2(0.085, 0.16),
			new THREE.Vector2(0.06, 0.27), new THREE.Vector2(0.035, 0.33), new THREE.Vector2(0.045, 0.39), new THREE.Vector2(0.04, 0.44), new THREE.Vector2(0.0, 0.46)
		], 20);
		var pinMat = std(0xf4f2ee, { roughness: 0.25, emissive: 0x223355, emissiveIntensity: 0.3 });
		var stripe = new THREE.MeshBasicMaterial({ color: 0xd8322b });
		var pins = [], rows = [[0], [-1, 1], [-2, 0, 2], [-3, -1, 1, 3]];
		rows.forEach(function (r, ri) {
			r.forEach(function (c) {
				var p = new THREE.Group();
				p.add(new THREE.Mesh(pinGeo, pinMat));
				var band = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.037, 0.037, 0.02, 16), stripe); band.position.y = 0.355; p.add(band);
				p.userData.home = new THREE.Vector3(laneX + c * 0.15, 0, pinZ - ri * 0.26);
				p.position.copy(p.userData.home);
				grp.add(p); pins.push(p);
			});
		});
		var ball = new THREE.Mesh(new THREE.SphereBufferGeometry(0.16, 32, 20), std(0x2b5cff, { roughness: 0.15, metalness: 0.35, emissive: 0x0a2a99, emissiveIntensity: 0.5 }));
		ball.visible = false;
		grp.add(ball);
		var roll = -1, knocked = false;
		function reset() { pins.forEach(function (p) { p.userData.fall = null; p.position.copy(p.userData.home); p.rotation.set(0, 0, 0); }); }
		function launch() { roll = 0; knocked = false; ball.visible = true; reset(); }
		st.onClick = function () { if (st.life > 0.6) launch(); };
		st.update = function (t, life, dt) {
			if (life > 0.75 && roll < 0 && !st.done) { st.done = true; launch(); }
			if (life < 0.2) { st.done = false; roll = -1; ball.visible = false; reset(); }
			if (roll >= 0) {
				roll += dt / 1.6;
				var k = Math.min(roll, 1);
				ball.position.set(laneX + Math.sin(k * 2.2) * 0.2, 0.16, -1.0 + (pinZ + 1.0) * k);
				ball.rotation.x -= dt * 10;
				if (k >= 1 && !knocked) {
					knocked = true;
					addRipple(grp.position.x + laneX, grp.position.z + pinZ - 0.3, 1.5);
					pins.forEach(function (p) { p.userData.fall = { t: 0, ax: (Math.random() - 0.5) * 2, vx: (Math.random() - 0.5) * 1.6, vz: -0.6 - Math.random() * 1.2 }; });
				}
				if (roll > 1.6) ball.visible = false;
			}
			pins.forEach(function (p) {
				var f = p.userData.fall;
				p.visible = life > 0.05;
				p.scale.setScalar(Math.max(0.001, smooth(0.05, 0.4, life)));
				if (!f) return;
				f.t = Math.min(f.t + dt, 0.7);
				var e = 1 - Math.pow(1 - f.t / 0.7, 3);
				p.rotation.x = -1.45 * e;
				p.rotation.z = f.ax * e * 0.6;
				p.position.x = p.userData.home.x + f.vx * e * 0.5;
				p.position.z = p.userData.home.z + f.vz * e * 0.5;
				p.position.y = 0.05 * e;
			});
		};
	};

	// Tennis played with a real swing: a court drawn on the floor, a net, and
	// a ball rallying over it. Click to hit it back harder.
	BUILD.tennis = function (st, grp) {
		// the court runs back on his right-hand side, clear of the monitor
		var CX = -0.9;
		st.floorKey = 'grass'; st.floorAt = [CX, -5.2];
		var lines = textTex(512, 1024), g = lines.g;
		g.strokeStyle = '#fff'; g.lineWidth = 10;
		g.strokeRect(40, 40, 432, 944); g.strokeRect(100, 40, 312, 944);
		g.beginPath(); g.moveTo(100, 300); g.lineTo(412, 300); g.moveTo(100, 724); g.lineTo(412, 724); g.moveTo(256, 300); g.lineTo(256, 724); g.stroke();
		lines.t.needsUpdate = true;
		var court = new THREE.Mesh(new THREE.PlaneBufferGeometry(4.2, 8.4), new THREE.MeshBasicMaterial({ map: lines.t, color: 0xeaffb0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
		court.rotation.x = -Math.PI / 2; court.position.set(CX, 0.014, -6.2);
		grp.add(court);
		var netTex = ledGrid.clone(); netTex.needsUpdate = true; netTex.repeat.set(60, 12);
		var net = new THREE.Group();
		var mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(4.6, 0.9), new THREE.MeshBasicMaterial({ map: netTex, color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
		mesh.position.y = 0.45; net.add(mesh);
		var tape = new THREE.Mesh(new THREE.BoxBufferGeometry(4.6, 0.06, 0.03), std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 }));
		tape.position.y = 0.92; net.add(tape);
		[-2.35, 2.35].forEach(function (x) { var post = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.035, 0.035, 1.0, 12), std(0x1a1d1a, { metalness: 0.6, roughness: 0.4 })); post.position.set(x, 0.5, 0); net.add(post); });
		net.position.set(CX, 0, -6.2);
		grp.add(net);
		var ball = new THREE.Mesh(new THREE.SphereBufferGeometry(0.075, 24, 16), std(0xd8ff3a, { emissive: 0x9acc00, emissiveIntensity: 0.8, roughness: 0.6 }));
		grp.add(ball);
		var trailN = 14, trail = [];
		for (var i = 0; i < trailN; i++) {
			var d = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xd8ff3a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
			grp.add(d); trail.push(d);
		}
		// a racket floating where the player would stand
		var racket = new THREE.Group();
		var head = new THREE.Mesh(new THREE.TorusBufferGeometry(0.2, 0.018, 10, 40), std(0x1b1b1b, { metalness: 0.4, roughness: 0.3 }));
		head.scale.set(1, 1.3, 1); head.position.y = 0.56; racket.add(head);
		var strings = new THREE.Mesh(new THREE.CircleBufferGeometry(0.2, 32), new THREE.MeshBasicMaterial({ map: netTex, color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
		strings.scale.set(1, 1.3, 1); strings.position.y = 0.56; racket.add(strings);
		var handle = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.022, 0.022, 0.32, 10), std(0xd94a2b, { roughness: 0.7 }));
		handle.position.y = 0.16; racket.add(handle);
		grp.add(racket);
		var phase = 0, speed = 0.55, hist = [];
		st.onClick = function () { if (st.life > 0.6) speed = 1.2; };
		st.update = function (t, life, dt) {
			var k = smooth(0.05, 0.6, life);
			court.material.opacity = 0.8 * k;
			net.scale.set(1, Math.max(0.001, k), 1); net.visible = k > 0.01;
			speed = damp(speed, 0.55, 1.2, dt);
			var prev = phase;
			phase += dt * speed;
			var u = phase % 2, dir = u < 1 ? 1 : -1, f = u < 1 ? u : 2 - u;
			// near baseline (z -2.6) to far baseline (z -9.8), bouncing once on each side
			var z = -2.6 - 7.2 * f, x = CX + Math.sin(phase * 1.7) * 1.1;
			var arc = f < 0.62 ? Math.sin(f / 0.62 * Math.PI) * 1.5 : Math.sin((f - 0.62) / 0.38 * Math.PI) * 0.7;
			ball.position.set(x, 0.08 + arc, z);
			ball.visible = k > 0.3; ball.scale.setScalar(Math.max(0.001, k));
			if (k > 0.5 && ((prev % 2 < 0.62 && phase % 2 >= 0.62) || (prev % 2 < 1.38 && phase % 2 >= 1.38))) addRipple(grp.position.x + x, grp.position.z + z, 0.6);
			hist.unshift(ball.position.clone()); if (hist.length > trailN) hist.pop();
			trail.forEach(function (d, j) {
				var hp = hist[Math.min(j, hist.length - 1)];
				d.position.copy(hp); d.lookAt(camera.position);
				d.material.opacity = ball.visible ? 0.5 * (1 - j / trailN) * k : 0;
			});
			var swing = u < 0.2 ? 1 - u / 0.2 : 0;
			racket.position.set(x + 0.35, 0.9 + Math.sin(t * 1.5) * 0.04, -2.3);
			racket.rotation.set(0.2, 0.4 - swing * 1.4, -0.5 + swing * 0.9);
			racket.scale.setScalar(Math.max(0.001, k));
		};
	};

	// Hugo Boss: visitors become shadows built from particles. Here the
	// particles gather into a shadow that follows Burhan along the wall.
	BUILD.shadow = function (st, grp) {
		st.floorKey = 'runway'; st.floorAt = [-0.3, -1.6];
		var wall = new THREE.Mesh(new THREE.PlaneBufferGeometry(5.2, 3.2), std(0x6e675c, { roughness: 0.95, emissive: 0x16130f, emissiveIntensity: 0.4 }));
		wall.position.set(-0.9, 1.6, -8.4); wall.rotation.y = 0.18;
		grp.add(wall);
		var logo = textTex(1024, 256), g = logo.g;
		onFont(function () {
			g.clearRect(0, 0, 1024, 256);
			g.fillStyle = '#111'; g.font = '700 170px "Space Grotesk", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
			g.fillText('BOSS', 512, 136); logo.t.needsUpdate = true;
		});
		var mark = new THREE.Mesh(new THREE.PlaneBufferGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: logo.t, transparent: true, depthWrite: false }));
		mark.position.set(0, 1.25, 0.01); wall.add(mark);
		var n = coarse ? 700 : 1600, pos = new Float32Array(n * 3), home = new Float32Array(n * 2);
		for (var i = 0; i < n; i++) {
			// sample a standing figure: head, torso, legs
			var r = Math.random(), x, y;
			if (r < 0.12) { var a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * 0.13; x = Math.cos(a) * rr; y = 1.55 + Math.sin(a) * rr * 1.2; }
			else if (r < 0.6) { y = 0.85 + Math.random() * 0.55; x = (Math.random() - 0.5) * (0.42 - (y - 0.85) * 0.1); }
			else { y = Math.random() * 0.85; x = (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.08); }
			home[i * 2] = x; home[i * 2 + 1] = y;
			pos[i * 3] = (Math.random() - 0.5) * 5; pos[i * 3 + 1] = Math.random() * 3; pos[i * 3 + 2] = 0.02;
		}
		var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		var mat = new THREE.PointsMaterial({ color: 0x050404, size: 0.06, transparent: true, opacity: 0, depthWrite: false });
		var pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
		wall.add(pts);
		var follow = 0;
		st.update = function (t, life, dt) {
			var k = smooth(0.05, 0.6, life);
			wall.scale.set(1, Math.max(0.001, k), 1); wall.visible = k > 0.01;
			mat.opacity = 0.85 * smooth(0.4, 1, life);
			follow = damp(follow, (mouse.x || 0) * 1.4, 2, dt);
			var gather = smooth(0.5, 1, life);
			for (var i = 0; i < n; i++) {
				var tx = home[i * 2] * 1.6 + follow + Math.sin(t * 2 + i) * 0.01, ty = home[i * 2 + 1] * 1.6 - 1.55;
				var wob = (1 - gather);
				tx += Math.sin(i * 12.9 + t * 0.7) * 2.2 * wob; ty += Math.cos(i * 7.3 + t * 0.5) * 1.3 * wob;
				pos[i * 3] += (tx - pos[i * 3]) * Math.min(1, dt * 3);
				pos[i * 3 + 1] += (ty - pos[i * 3 + 1]) * Math.min(1, dt * 3);
			}
			geo.attributes.position.needsUpdate = true;
		};
	};

	// Lusail: the festival floor's fireworks. Each one launches from the floor
	// where someone stood, climbs on a trail of sparks and bursts over the square:
	// round shells, tilted rings and slow gold willows.
	BUILD.fireworks = function (st, grp) {
		st.floorKey = 'water'; st.floorAt = [-0.6, -3.6];
		var BP = coarse ? 90 : 150, NB = 8, N = BP * NB, slot = 0;
		var pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), base = new Float32Array(N * 3);
		var age = new Float32Array(N).fill(99), span = new Float32Array(N).fill(1), drag = new Float32Array(N), grav = new Float32Array(N), tw = new Float32Array(N);
		var geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
		var sparks = new THREE.Points(geo, new THREE.PointsMaterial({ size: coarse ? 0.34 : 0.3, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
		sparks.frustumCulled = false; grp.add(sparks);
		// each spark draws a short streak behind it
		var lp = new Float32Array(N * 6), lc = new Float32Array(N * 6), lgeo = new THREE.BufferGeometry();
		lgeo.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lgeo.setAttribute('color', new THREE.BufferAttribute(lc, 3));
		var streaks = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
		streaks.frustumCulled = false; grp.add(streaks);
		var RN = 4, TN = 16, rockets = [], rP = new Float32Array(RN * TN * 3), rC = new Float32Array(RN * TN * 3);
		var rGeo = new THREE.BufferGeometry();
		rGeo.setAttribute('position', new THREE.BufferAttribute(rP, 3)); rGeo.setAttribute('color', new THREE.BufferAttribute(rC, 3));
		var trails = new THREE.Points(rGeo, new THREE.PointsMaterial({ size: 0.14, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
		trails.frustumCulled = false; grp.add(trails);
		for (var i = 0; i < RN; i++) {
			var fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0dc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
			fl.visible = false; grp.add(fl);
			rockets.push({ on: false, x: 0, z: 0, yb: 3, t0: 0, dur: 1, fade: 0, flash: fl, ft: -9 });
		}
		var PAL = [[1, 0.31, 0.85], [1, 0.82, 0.29], [0.35, 0.88, 1], [1, 0.42, 0.23], [0.66, 0.48, 1], [0.5, 1, 0.62]];
		var _ax = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3();
		function burst(x, y, z) {
			var type = Math.random(), willow = type < 0.22, ring = !willow && type < 0.45;
			var c = PAL[Math.floor(Math.random() * PAL.length)], c2 = PAL[Math.floor(Math.random() * PAL.length)];
			if (ring) {
				_ax.set(Math.random() - 0.5, 1.2, Math.random() * 0.8 + 0.4).normalize();
				_u.set(1, 0, 0).cross(_ax).normalize(); _v.crossVectors(_ax, _u);
			}
			var b0 = slot * BP; slot = (slot + 1) % NB;
			for (var i = 0; i < BP; i++) {
				var j = b0 + i, j3 = j * 3, dx, dy, dz, sp, cc = c;
				if (ring) {
					var a = i / BP * 6.283;
					dx = Math.cos(a) * _u.x + Math.sin(a) * _v.x; dy = Math.cos(a) * _u.y + Math.sin(a) * _v.y; dz = Math.cos(a) * _u.z + Math.sin(a) * _v.z;
					sp = 2.7 + Math.random() * 0.2;
					if (i % 4 === 0) { sp *= 0.5; cc = c2; }
				} else {
					var uu = Math.random() * 2 - 1, aa = Math.random() * 6.283, ss = Math.sqrt(1 - uu * uu);
					dx = ss * Math.cos(aa); dy = uu; dz = ss * Math.sin(aa);
					sp = willow ? 1.7 + Math.random() * 0.5 : 2.4 + Math.random() * 0.6;
					// a second, smaller shell inside the first in another colour
					if (!willow && i % 3 === 0) { sp *= 0.55; cc = c2; }
				}
				pos[j3] = x; pos[j3 + 1] = y; pos[j3 + 2] = z;
				vel[j3] = dx * sp; vel[j3 + 1] = dy * sp; vel[j3 + 2] = dz * sp;
				if (willow) { base[j3] = 1; base[j3 + 1] = 0.72; base[j3 + 2] = 0.32; } else { base[j3] = cc[0]; base[j3 + 1] = cc[1]; base[j3 + 2] = cc[2]; }
				age[j] = 0; span[j] = willow ? 2.3 + Math.random() * 0.7 : 1.3 + Math.random() * 0.5;
				drag[j] = willow ? 1.5 : 1.1; grav[j] = willow ? 1.3 : 0.9; tw[j] = willow ? 1 : 0;
			}
		}
		function launch(t) {
			var r = null;
			for (var k = 0; k < RN; k++) if (!rockets[k].on && t - rockets[k].ft > 0.4) { r = rockets[k]; break; }
			if (!r) return;
			if (mobile) { r.x = (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 1.9); r.z = -7 + Math.random() * 2.5; r.yb = 1.4 + Math.random() * 0.45; }
			else { r.x = -3.0 + Math.random() * 4.0; r.z = -7.6 + Math.random() * 3.0; r.yb = 2.9 + Math.random() * 1.3; }
			r.t0 = t; r.dur = 0.85 + Math.random() * 0.3; r.on = true; r.fade = 1;
			var b = r.idx * TN * 3;
			for (var j = 0; j < TN; j++) { rP[b + j * 3] = r.x; rP[b + j * 3 + 1] = 0; rP[b + j * 3 + 2] = r.z; }
			addRipple(grp.position.x + r.x, grp.position.z + r.z, 0.9);
		}
		rockets.forEach(function (r, k) { r.idx = k; });
		var next = 0;
		// every step he takes sets one off
		st.onStep = function () { if (st.life > 0.6) next = 0; };
		st.hide = function () { rockets.forEach(function (r) { r.on = false; r.fade = 0; r.flash.visible = false; }); age.fill(99); };
		st.update = function (t, life, dt) {
			var k = smooth(0.3, 0.8, life);
			next -= dt;
			if (life > 0.4 && next <= 0) { launch(t); next = 0.45 + Math.random() * 0.5; }
			rockets.forEach(function (r) {
				var b = r.idx * TN * 3, hx = rP[b], hy = rP[b + 1], hz = rP[b + 2];
				if (r.on) {
					var u = (t - r.t0) / r.dur;
					if (u >= 1) {
						r.on = false; burst(hx, hy, hz); r.ft = t;
						addRipple(grp.position.x + hx, grp.position.z + hz, 1.3);
					} else {
						var e = 1 - (1 - u) * (1 - u);
						hx = r.x + Math.sin(u * 5 + r.idx) * 0.06; hy = r.yb * e; hz = r.z;
					}
				}
				for (var j = TN - 1; j > 0; j--) { rP[b + j * 3] = rP[b + j * 3 - 3]; rP[b + j * 3 + 1] = rP[b + j * 3 - 2] - 0.012; rP[b + j * 3 + 2] = rP[b + j * 3 - 1]; }
				rP[b] = hx; rP[b + 1] = hy; rP[b + 2] = hz;
				if (!r.on) r.fade = Math.max(0, r.fade - dt * 4);
				for (j = 0; j < TN; j++) { var f = k * r.fade * Math.pow(1 - j / TN, 1.8) * (j ? 0.7 : 1.4); rC[b + j * 3] = f; rC[b + j * 3 + 1] = f * 0.78; rC[b + j * 3 + 2] = f * 0.5; }
				var fa = t - r.ft;
				r.flash.visible = fa < 0.4;
				if (r.flash.visible) { r.flash.position.set(hx, hy, hz); r.flash.scale.setScalar(0.8 + easeOut(fa / 0.4) * 2.2); r.flash.material.opacity = 0.75 * k * (1 - fa / 0.4); }
			});
			rGeo.attributes.position.needsUpdate = true; rGeo.attributes.color.needsUpdate = true;
			var h = Math.min(dt, 0.05);
			for (var i = 0; i < N; i++) {
				var i3 = i * 3;
				if (age[i] > span[i]) { if (col[i3] || col[i3 + 1] || col[i3 + 2]) col[i3] = col[i3 + 1] = col[i3 + 2] = lc[i * 6] = lc[i * 6 + 1] = lc[i * 6 + 2] = 0; continue; }
				age[i] += h;
				var dr = Math.exp(-drag[i] * h);
				vel[i3] *= dr; vel[i3 + 1] = vel[i3 + 1] * dr - grav[i] * h; vel[i3 + 2] *= dr;
				pos[i3] += vel[i3] * h; pos[i3 + 1] += vel[i3 + 1] * h; pos[i3 + 2] += vel[i3 + 2] * h;
				// white hot at the burst, then the colour, then dimming out (willows twinkle as they fall)
				var a = age[i] / span[i], w = Math.exp(-age[i] * 7), fade = k * Math.pow(1 - a, 1.3) * (tw[i] ? 0.6 + 0.4 * Math.sin(age[i] * 38 + i) : 1);
				col[i3] = (base[i3] + (1 - base[i3]) * w) * fade; col[i3 + 1] = (base[i3 + 1] + (1 - base[i3 + 1]) * w) * fade; col[i3 + 2] = (base[i3 + 2] + (1 - base[i3 + 2]) * w) * fade;
				var i6 = i * 6;
				lp[i6] = pos[i3]; lp[i6 + 1] = pos[i3 + 1]; lp[i6 + 2] = pos[i3 + 2];
				lp[i6 + 3] = pos[i3] - vel[i3] * 0.14; lp[i6 + 4] = pos[i3 + 1] - vel[i3 + 1] * 0.14; lp[i6 + 5] = pos[i3 + 2] - vel[i3 + 2] * 0.14;
				lc[i6] = col[i3]; lc[i6 + 1] = col[i3 + 1]; lc[i6 + 2] = col[i3 + 2];
			}
			geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
			lgeo.attributes.position.needsUpdate = true; lgeo.attributes.color.needsUpdate = true;
		};
	};

	// Dubai Police 360 VR: the city under its cyber shield, with threats flying in
	// and breaking on it. The dome and the threat orbs are ports of the film's own
	// shaders (VRCity/CityShieldDefense and CyberShield/ThreatEnergySphere).
	var SHIELD_VS = [
		'uniform vec3 uRad; varying vec3 vLocal; varying vec3 vN; varying vec3 vV; varying float vH;',
		'void main(){',
		'  vLocal = position * uRad; vH = position.y;',
		'  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
		'  vN = normalize(normalMatrix * normal); vV = -mv.xyz;',
		'  gl_Position = projectionMatrix * mv;',
		'}'
	].join('\n');
	var SHIELD_FS = [
		'uniform float uTime; uniform float uLife; uniform float uReveal; uniform float uCell; uniform vec3 uRad; uniform vec4 uHole; uniform vec2 uRes;',
		'uniform vec4 uImp[4]; uniform vec4 uImpP[4]; uniform vec4 uTgt[4];',
		'varying vec3 vLocal; varying vec3 vN; varying vec3 vV; varying float vH;',
		'const vec3 TEAL = vec3(0.03, 0.42, 0.46); const vec3 TOP = vec3(0.05, 0.55, 0.42); const vec3 WAVE = vec3(0.08, 0.9, 0.55);',
		'const vec3 RED = vec3(2.6, 0.1, 0.04); const vec3 ORANGE = vec3(2.4, 0.75, 0.05); const vec3 CYAN = vec3(0.2, 2.2, 2.6);',
		'const vec3 GREEN = vec3(0.1, 1.9, 0.75); const vec3 CORE = vec3(3.2, 1.3, 0.9);',
		'float sq(float x){ return x * x; }',
		'float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
		'float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);',
		'  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),',
		'             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }',
		'float fbm(vec3 p){ float v = 0.5 * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); v += 0.25 * noise(p);',
		'#if LITE',
		'  return v / 0.75;',
		'#else',
		'  p = p * 2.01 + vec3(8.3, 2.8, 5.4); v += 0.125 * noise(p); return v / 0.875;',
		'#endif',
		'}',
		// threat hit colour over time: red, absorbed orange, cyan, then Dubai Police green
		'vec3 hue(float age){',
		'  vec3 c = mix(RED, ORANGE, smoothstep(0.42, 0.6, age));',
		'  c = mix(c, CYAN, smoothstep(0.66, 0.84, age));',
		'  c = mix(c, GREEN, smoothstep(0.84, 1.2, age));',
		'  return c * (1.0 - 0.55 * exp(-sq((age - 0.75) / 0.09)));',
		'}',
		'void main(){',
		'  if (vH > uReveal) discard;',
		// hex cells laid out as seen from the front, so they stay regular across the whole dome
		'  vec2 p = vLocal.xy / uCell;',
		'  vec2 cs = vec2(1.7320508, 3.0);',
		'  vec2 a = mod(p, cs) - cs * 0.5; vec2 b = mod(p + cs * 0.5, cs) - cs * 0.5;',
		'  vec2 hex = dot(a, a) < dot(b, b) ? a : b;',
		'  vec2 cuv = p - hex;',
		'  vec2 cxy = cuv * uCell;',
		'  float e = 1.0 - sq(cxy.x / uRad.x) - sq(cxy.y / uRad.y);',
		'  vec3 cpos = vec3(cxy, sign(vLocal.z) * uRad.z * sqrt(max(e, 0.0)));',
		'  vec3 cdir = normalize(cpos / uRad + vec3(0.0, 0.001, 0.0));',
		'  float cr = hash(vec3(floor(cuv * 4.0 + 0.5), 7.0));',
		'  vec3 cellCol = vec3(0.0), ringCol = vec3(0.0), flashCol = vec3(0.0); float rip = 0.0;',
		'  for (int k = 0; k < 4; k++) {',
		'    vec4 imp = uImp[k]; vec4 prm = uImpP[k];',
		'    float heavy = prm.z;',
		'    float age = uTime - imp.w;',
		'    if (age < 0.0 || age > 1.8 * (1.0 + heavy * 0.5)) continue;',
		'    float s = prm.y, str = prm.x;',
		'    float d = distance(vLocal, imp.xyz) / s, dc = distance(cpos, imp.xyz) / s;',
		'    float life = clamp(age / (1.8 * (1.0 + heavy * 0.5)), 0.0, 1.0);',
		'    float core = exp(-d * d * 9.0) * exp(-age * 22.0) * (1.0 + heavy);',
		'    float ring0 = exp(-sq((d - 0.35 - age * 3.0) / 0.07)) * clamp(1.0 - age / 0.16, 0.0, 1.0);',
		'    float rA = age * 5.5;',
		'    float ringA = exp(-sq((d - rA) / 0.12)) * exp(-age * 6.5);',
		'    float rB = max(age - 0.05, 0.0) * 5.5 * 0.62;',
		'    float ringB = exp(-sq((d - rB) / 0.2)) * exp(-age * 4.0) * 0.55;',
		'    float rC = max(age - 0.1, 0.0) * 5.5 * 0.4;',
		'    float ringC = exp(-sq((d - rC) / 0.38)) * (1.0 - life) * 0.22;',
		'    rip += (ringA + ringB * 0.6) * str;',
		'    float reach = rB * 0.75 + 0.7 + heavy * 0.4;',
		'    float inside = clamp((reach - dc) * 1.6 + (cr - 0.5) * 0.9, 0.0, 1.0);',
		'    float behind = exp(-max(rB - dc - 0.4, 0.0) * 1.1);',
		'    float cells = inside * behind * clamp(1.0 - life * 1.15, 0.0, 1.0) * step(dc, 2.6 + heavy * 1.2) * (0.6 + 0.4 * cr) * str;',
		'    float mixT = clamp(dc / max(reach, 0.01), 0.0, 1.0);',
		'    float crack = 0.0;',
		'    if (heavy > 0.5) {',
		'      float n = noise((vLocal - imp.xyz) / s * 2.2 + prm.w * 13.0);',
		'      crack = pow(clamp(1.0 - abs(n * 2.0 - 1.0), 0.0, 1.0), 26.0) * exp(-d * 1.4) * clamp(1.0 - age / 0.35, 0.0, 1.0) * 0.45 * str;',
		'    }',
		'    cellCol += cells * hue(age + mixT * 0.12);',
		'    ringCol += (ring0 * 1.4 + ringA + ringB + ringC) * str * hue(age + 0.08);',
		'    flashCol += CORE * core * str * 1.3 + mix(ORANGE, RED, 0.5) * crack;',
		'  }',
		// where an incoming threat is about to land, the cells lock on in pulsing red
		'  for (int k = 0; k < 4; k++) {',
		'    vec4 tg = uTgt[k];',
		'    if (tg.w <= 0.001) continue;',
		'    float dc = distance(cpos, tg.xyz) / 0.6, d = distance(vLocal, tg.xyz) / 0.6, kk = tg.w;',
		'    float pulse = 0.65 + 0.35 * sin(uTime * (9.0 + kk * 10.0));',
		'    cellCol += RED * clamp((1.25 + kk * 0.5 - dc) * 2.0 + (cr - 0.5) * 0.7, 0.0, 1.0) * pulse * kk * 0.75;',
		'    ringCol += RED * exp(-sq((d - (1.8 - kk * 0.75)) / 0.06)) * kk * 0.9;',
		'  }',
		'  float wob = clamp(rip, 0.0, 1.0) * 0.35;',
		'  vec2 hd = abs(hex + wob * 0.22 * vec2(sin(p.y * 2.3 + uTime * 23.0), cos(p.x * 2.1 + uTime * 19.0)));',
		'  float edge = 0.8660254 - max(dot(hd, vec2(0.5, 0.8660254)), hd.x);',
		'  float aa = max(fwidth(edge), 0.002);',
		'  float lw = 0.022 * (1.0 + wob * 2.5);',
		'  float grid = 1.0 - smoothstep(lw, lw + aa, edge);',
		'  grid = mix(grid, clamp(lw * 2.6, 0.0, 1.0), clamp(aa * 14.0 - 0.4, 0.0, 1.0));',
		// slow fractal energy drifting through the cells
		'  vec3 q = cdir * 3.5;',
		'  vec3 drift = vec3(uTime * 0.02, uTime * 0.012, -uTime * 0.016);',
		'  float warp = fbm(q + drift);',
		'  float n = fbm(q * 1.7 + warp * 1.8 - drift * 1.3);',
		'  float veins = pow(clamp(1.0 - abs(2.0 * n - 1.0), 0.0, 1.0), 8.0);',
		'  float patches = smoothstep(0.45, 0.75, warp);',
		'  float inner = clamp(1.0 - edge * 1.6, 0.0, 1.0);',
		'  float ch = clamp(cpos.y / uRad.y, 0.0, 1.0);',
		'  float front = clamp(ch * 2.0, 0.0, 1.0) + (warp - 0.5) * 0.55 + (n - 0.5) * 0.25 + 0.06 * sin(cdir.x * 9.0 + uTime * 0.37);',
		'  float wd = abs(front - fract(uTime * 0.07)); wd = min(wd, 1.0 - wd);',
		'  float band = exp(-sq(wd / 0.05));',
		'  float shimmer = mix(0.85, 1.0, hash(floor(cdir * 97.0 + 0.5) + floor(uTime * 5.0)));',
		'  float fres = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 3.0);',
		'  float breathe = 1.0 + sin(uTime * 0.55) * 0.5;',
		'  float fade = 1.0 - 0.45 * smoothstep(0.55, 1.0, vH);',
		'  vec3 tint = mix(TEAL, TOP, smoothstep(0.15, 0.95, vH));',
		'  float heat = smoothstep(0.6, 0.78, n) * (0.35 + 0.65 * patches) + veins * 0.8;',
		'  vec3 col = tint * (grid * (0.1 + heat * 0.42 + band * 0.3) + heat * inner * 0.05) * shimmer;',
		'  col += WAVE * band * grid * (0.35 + heat * 1.2);',
		'  col += tint * fres * (0.38 + 0.12 * breathe);',
		'  col *= fade;',
		// lighter over the video screen inside it, so the film stays clear
		'  vec2 sp = gl_FragCoord.xy / uRes * 2.0 - 1.0;',
		'  col *= 1.0 - 0.7 * smoothstep(0.0, 0.04, min(min(sp.x - uHole.x, uHole.y - sp.x), min(sp.y - uHole.z, uHole.w - sp.y)));',
		// the shield builds up from the ground with a bright edge as he arrives
		'  col += WAVE * exp(-sq((vH - uReveal) / 0.025)) * step(uReveal, 0.999) * 1.6;',
		'  col *= uLife;',
		'  col += cellCol * (grid * 1.6 + inner * 0.22) + ringCol * (0.55 + grid * 1.2) + flashCol;',
		'  float dim = clamp(dot(cellCol + ringCol * 0.6 + flashCol, vec3(0.33)) * 0.5, 0.0, 1.0) * 0.45;',
		'  gl_FragColor = vec4(max(col, 0.0), dim);',
		// without the bloom pass this blends after gamma, where a faint glow would read as a haze
		'#if GAMMA_BLEND',
		'  gl_FragColor.rgb *= 1.6;',
		'#else',
		'  #include <encodings_fragment>',
		'#endif',
		'}'
	].join('\n');
	// camera-facing quad: a dark crimson glass sphere with a hot rim, two orbiting rings and the threat's icon
	var ORB_VS = [
		'uniform float uSize; varying vec2 vP;',
		'void main(){ vP = position.xy * 2.0; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * uSize; gl_Position = projectionMatrix * mv; }'
	].join('\n');
	var ORB_FS = [
		'uniform float uTime; uniform float uAlpha; uniform float uFlash; uniform float uCrack; uniform float uSeed;',
		'uniform sampler2D uIcon; uniform vec2 uCell; varying vec2 vP;',
		'float sq(float x){ return x * x; }',
		'float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }',
		'float n1(float x){ float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }',
		'float ring(vec2 p, float ang, float tilt, float rad, float w){',
		'  float s = sin(ang), c = cos(ang); vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);',
		'  return exp(-sq((length(vec2(q.x, q.y / tilt)) - rad) * tilt / w)) * (step(0.0, q.y) * 0.55 + 0.45);',
		'}',
		'void main(){',
		'  vec2 p = vP; float r = length(p); if (r > 1.0) discard;',
		'  float t = uTime + uSeed * 7.0;',
		'  float au = atan(p.y, p.x) / 6.2831853 + 0.5;',
		'  float dest = uCrack;',
		'  float rr = r + (n1(au * 14.0 + t * 6.0) - 0.5) * (0.02 + dest * 0.1) + (n1(au * 37.0 - t * 11.0) - 0.5) * dest * 0.05;',
		'  float segId = floor(au * 9.0 + uSeed), seg = fract(au * 9.0 + uSeed);',
		'  float keep = mix(1.0, step(uCrack * 1.05, h1(segId + uSeed * 3.1)) * smoothstep(0.0, 0.08, seg) * smoothstep(1.0, 0.92, seg), step(0.001, uCrack));',
		'  rr -= uCrack * 0.22 * h1(segId + 1.7);',
		'  const float R = 0.78;',
		'  float inside = 1.0 - smoothstep(R - 0.02, R + 0.02, rr);',
		'  float body = inside * (1.0 - uCrack);',
		'  float rim = exp(-sq((rr - R) / 0.035)) * keep;',
		'  float halo = exp(-max(rr - R, 0.0) / 0.09) * (1.0 - inside) * 0.55 * keep;',
		'  float fres = (pow(clamp(rr / R, 0.0, 1.0), 4.0) * 0.6 + 0.12) * inside * (1.0 - uCrack);',
		'  float rings = (ring(p, t * 0.9, 0.3, 0.56, 0.022) + ring(p, -t * 0.6 + 1.7, 0.55, 0.44, 0.02) * 0.6) * 0.45 * (1.0 - uCrack);',
		'  vec2 sp = vec2(cos(t * 2.4), sin(t * 2.4) * 0.3) * 0.56;',
		'  float spark = exp(-dot(p - sp, p - sp) * 700.0) * step(0.0, sin(t * 2.4)) * (1.0 - uCrack);',
		'  vec2 iu = p / (R * 0.66) * 0.5 + 0.5;',
		'  float icon = 0.0;',
		'  if (iu.x > 0.0 && iu.x < 1.0 && iu.y > 0.0 && iu.y < 1.0) icon = texture2D(uIcon, vec2((uCell.x + iu.x) / 4.0, 1.0 - (uCell.y + 1.0 - iu.y) / 2.0)).a;',
		'  icon *= inside * (1.0 - uCrack);',
		'  vec3 light = vec3(2.6, 0.32, 0.08) * (rim * 1.3 + halo * 0.6) + vec3(1.9, 0.1, 0.035) * (fres + rings) + vec3(2.6, 1.2, 0.6) * spark + vec3(2.6, 0.75, 0.55) * icon;',
		'  light *= 1.0 + uFlash;',
		'  float a = body * 0.55;',
		'  gl_FragColor = vec4((vec3(0.09, 0.004, 0.002) * a + light) * uAlpha, a * uAlpha);',
		'  #include <encodings_fragment>',
		'}'
	].join('\n');
	var TRAIL_VS = 'attribute float aT; attribute float aS; varying float vT; varying float vS; void main(){ vT = aT; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
	var TRAIL_FS = [
		'uniform float uAlpha; varying float vT; varying float vS;',
		'void main(){',
		'  float k = pow(max(1.0 - vT, 0.0), 1.6) * (1.0 - vS * vS) * uAlpha;',
		'  gl_FragColor = vec4(mix(vec3(2.4, 0.7, 0.35), vec3(1.6, 0.08, 0.03), vT) * k, 1.0);',
		'  #include <encodings_fragment>',
		'}'
	].join('\n');
	// line icons for the threat types in the film: malware, a broken shield, ransomware,
	// phishing, a stolen password, a server attack, a virus and a warning
	var threatIcons = (function () {
		var c = document.createElement('canvas'); c.width = 512; c.height = 256;
		var g = c.getContext('2d');
		g.strokeStyle = g.fillStyle = '#fff'; g.lineWidth = 7; g.lineCap = g.lineJoin = 'round';
		function cell(k, draw) { g.save(); g.translate((k % 4) * 128 + 64, Math.floor(k / 4) * 128 + 64); g.beginPath(); draw(); g.restore(); }
		cell(0, function () { // bug
			g.ellipse(0, 10, 18, 26, 0, 0, Math.PI * 2); g.moveTo(10, -22); g.arc(0, -22, 10, 0, Math.PI * 2);
			[-6, 10, 26].forEach(function (y, i) { g.moveTo(-18, y); g.lineTo(-36, y - 8 + i * 6); g.moveTo(18, y); g.lineTo(36, y - 8 + i * 6); });
			g.moveTo(-5, -31); g.lineTo(-14, -44); g.moveTo(5, -31); g.lineTo(14, -44); g.moveTo(0, -14); g.lineTo(0, 34); g.stroke();
		});
		cell(1, function () { // broken shield
			g.moveTo(0, -42); g.quadraticCurveTo(20, -32, 36, -34); g.quadraticCurveTo(36, 16, 0, 44); g.quadraticCurveTo(-36, 16, -36, -34); g.quadraticCurveTo(-20, -32, 0, -42);
			g.moveTo(4, -40); g.lineTo(-8, -12); g.lineTo(8, 2); g.lineTo(-6, 22); g.lineTo(2, 42); g.stroke();
		});
		cell(2, function () { // padlock
			g.moveTo(-18, -6); g.lineTo(-18, -20); g.arc(0, -20, 18, Math.PI, 0); g.lineTo(18, -6);
			g.rect(-30, -6, 60, 46); g.moveTo(5, 12); g.arc(0, 12, 5, 0, Math.PI * 2); g.moveTo(0, 17); g.lineTo(0, 28); g.stroke();
		});
		cell(3, function () { // hook
			g.moveTo(10, -44); g.lineTo(10, 18); g.arc(-8, 18, 18, 0, Math.PI * 0.95); g.lineTo(-24, 4); g.lineTo(-30, 14);
			g.moveTo(10, -44); g.arc(10, -38, 6, -Math.PI / 2, Math.PI * 1.5); g.stroke();
		});
		cell(4, function () { // key
			g.arc(-20, 0, 16, 0, Math.PI * 2); g.moveTo(-4, 0); g.lineTo(40, 0); g.moveTo(28, 0); g.lineTo(28, 14); g.moveTo(38, 0); g.lineTo(38, 10); g.stroke();
		});
		cell(5, function () { // server rack
			[-34, -8, 18].forEach(function (y) { g.rect(-32, y, 64, 20); g.moveTo(-18, y + 10); g.lineTo(6, y + 10); });
			g.stroke(); g.beginPath(); [-34, -8, 18].forEach(function (y) { g.moveTo(24, y + 10); g.arc(20, y + 10, 4, 0, Math.PI * 2); }); g.fill();
		});
		cell(6, function () { // virus
			g.arc(0, 0, 20, 0, Math.PI * 2);
			for (var i = 0; i < 8; i++) { var an = i * Math.PI / 4, cx = Math.cos(an), sy = Math.sin(an); g.moveTo(cx * 20, sy * 20); g.lineTo(cx * 34, sy * 34); g.moveTo(cx * 34 + 5, sy * 34); g.arc(cx * 34, sy * 34, 5, 0, Math.PI * 2); }
			g.stroke();
		});
		cell(7, function () { // warning
			g.moveTo(0, -40); g.lineTo(40, 32); g.lineTo(-40, 32); g.closePath(); g.moveTo(0, -12); g.lineTo(0, 8); g.stroke();
			g.beginPath(); g.arc(0, 20, 4, 0, Math.PI * 2); g.fill();
		});
		var t = new THREE.CanvasTexture(c); t.anisotropy = 4;
		return t;
	})();

	BUILD.city = function (st, grp) {
		st.floorKey = 'grid'; st.floorAt = [0.6, -3.4];
		// the shield: a wide dome over the whole skyline, its centre well behind him
		var SC = new THREE.Vector3(0.9, 0, -13.2), SR = new THREE.Vector3(9.4, 6.9, 6.6);
		function sq(x) { return x * x; }
		function domeH(x, z) { var e = 1 - sq((x - SC.x) / SR.x) - sq((z - SC.z) / SR.z); return e > 0 ? SR.y * Math.sqrt(e) : 0; }
		var seed = 7;
		function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
		// the metro loops round the skyline on an elevated ring, all inside the shield;
		// it climbs towards the back so the loop reads from eye level
		var RING = { x: 0.6, z: -13.2, rx: 4.6, rz: 3.7, y: 2.5, tilt: 1.2 };
		function ringE(x, z) { return Math.sqrt(sq((x - RING.x) / RING.rx) + sq((z - RING.z) / RING.rz)); }
		// the ride pod and the flying cars fly their own loops too: the pod above the
		// metro's track, one car circling the top of the tallest tower and the other
		// sweeping round the edge of the shield
		var FLY = {
			pod: { x: 0.6, z: -13.2, rx: 4.75, rz: 3.85, y: 4.3, tilt: 0.5, amp: 0.1, v: 1.8, dir: 1, a: 0 },
			carA: { x: 0.0, z: -13.4, rx: 1.7, rz: 1.3, y: 5.3, tilt: 0, amp: 0.12, v: 3.0, dir: -1, a: 1 },
			carB: { x: 0.9, z: -12.8, rx: 5.6, rz: 4.6, y: 2.9, tilt: -0.4, amp: 0.2, v: 3.8, dir: -1, a: 2.5 }
		};
		function flyAt(P, a, out) { return out.set(P.x + Math.cos(a) * P.rx, P.y - P.tilt * Math.sin(a) + P.amp * Math.sin(a * 3 + P.rx), P.z + Math.sin(a) * P.rz); }
		// how tall a tower may stand without a car clipping it
		function headroom(x, z) {
			var cap = 99;
			[FLY.carA, FLY.carB].forEach(function (P) {
				var u = (x - P.x) / P.rx, w = (z - P.z) / P.rz, e = Math.sqrt(u * u + w * w);
				if (Math.abs(e - 1) * Math.min(P.rx, P.rz) < 0.75) cap = Math.min(cap, P.y - P.tilt * Math.sin(Math.atan2(w, u)) - P.amp - 0.5);
			});
			return cap;
		}

		var win = textTex(64, 128), wg = win.g;
		wg.fillStyle = '#071a1a'; wg.fillRect(0, 0, 64, 128);
		for (var yy = 4; yy < 128; yy += 8) for (var xx = 4; xx < 64; xx += 10) { wg.fillStyle = rnd() < 0.55 ? 'rgba(120,255,225,' + (0.35 + rnd() * 0.5) + ')' : 'rgba(40,90,90,0.4)'; wg.fillRect(xx, yy, 6, 4); }
		win.t.needsUpdate = true; win.t.wrapS = win.t.wrapT = THREE.RepeatWrapping;
		var city = new THREE.Group(), towers = [];
		// matte enough that a flat face never catches the key light as one bright block
		var bmat = new THREE.MeshStandardMaterial({ color: 0x0c2427, emissive: 0xffffff, emissiveMap: win.t, emissiveIntensity: 0.55, roughness: 0.62, metalness: 0.3 });
		// towers fill the shield's footprint, tallest towards the middle, all under the dome
		for (var n = 0; n < 400 && towers.length < 44; n++) {
			var ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.86;
			var x = SC.x + Math.cos(ang) * rr * SR.x, z = SC.z + Math.sin(ang) * rr * SR.z;
			if (z > -7.4 || Math.abs(x - 0.0) < 0.7 && Math.abs(z + 13.4) < 0.9 || Math.abs(ringE(x, z) - 1) < 0.2) continue;
			var w = 0.3 + rnd() * 0.42, hmax = domeH(x, z) * 0.8 - 0.3;
			if (hmax < 0.6) continue;
			var h = Math.min(hmax, headroom(x, z), 0.7 + hmax * Math.pow(rnd(), 1.4) * (1.1 - rr * 0.6));
			if (h < 0.6) continue;
			var m = new THREE.Mesh(new THREE.BoxBufferGeometry(w, h, w * (0.8 + rnd() * 0.4)), bmat);
			m.position.set(x, h / 2, z); m.rotation.y = (rnd() - 0.5) * 0.4;
			m.userData.h = h; city.add(m); towers.push(m);
		}
		// the tallest tower, tapering in steps, at the heart of the shield
		var burj = new THREE.Group();
		[[0.5, 2.2], [0.36, 1.8], [0.24, 1.4], [0.14, 1.1], [0.05, 0.9]].reduce(function (y, d) {
			var m = new THREE.Mesh(new THREE.CylinderBufferGeometry(d[0] * 0.8, d[0], d[1], 6), bmat);
			m.position.y = y + d[1] / 2; burj.add(m); return y + d[1];
		}, 0);
		burj.position.set(0.0, 0, -13.4); burj.scale.set(1, 0.84, 1); city.add(burj);
		grp.add(city);

		var shieldU = {
			uTime: { value: 0 }, uLife: { value: 0 }, uReveal: { value: 0 }, uCell: { value: 0.25 }, uRad: { value: SR.clone() },
			uHole: { value: new THREE.Vector4(9, 9, 9, 9) }, uRes: { value: new THREE.Vector2(1, 1) },
			uImp: { value: [0, 1, 2, 3].map(function () { return new THREE.Vector4(0, 0, 0, -100); }) },
			uImpP: { value: [0, 1, 2, 3].map(function () { return new THREE.Vector4(1, 1, 0, 0); }) },
			uTgt: { value: [0, 1, 2, 3].map(function () { return new THREE.Vector4(); }) }
		};
		var dome = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 96, 40, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
			uniforms: shieldU, vertexShader: SHIELD_VS, fragmentShader: SHIELD_FS, defines: { GAMMA_BLEND: composer ? 0 : 1, LITE: coarse ? 1 : 0 },
			transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: { derivatives: true },
			blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
		}));
		dome.position.copy(SC); dome.scale.copy(SR); dome.renderOrder = 2; dome.frustumCulled = false;
		grp.add(dome);
		// the emitter ring where the shield meets the ground
		var base = new THREE.Mesh(new THREE.RingBufferGeometry(0.985, 1.0, 160), new THREE.MeshBasicMaterial({ color: 0x3ff0c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
		base.rotation.x = -Math.PI / 2; base.position.set(SC.x, 0.025, SC.z); base.scale.set(SR.x, SR.z, 1); grp.add(base);

		// threats: up to four in the air at once
		var orbGeo = new THREE.PlaneBufferGeometry(1, 1), M = 18, threats = [];
		var trailT = new Float32Array(M * 2), trailS = new Float32Array(M * 2), trailIdx = [];
		for (var i = 0; i < M; i++) { trailT[i * 2] = trailT[i * 2 + 1] = i / (M - 1); trailS[i * 2] = -1; trailS[i * 2 + 1] = 1; }
		for (i = 0; i < M - 1; i++) { var a0 = i * 2; trailIdx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
		var flashMat = function () { return new THREE.SpriteMaterial({ map: glowTex, color: 0xff6a4a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); };
		for (i = 0; i < 4; i++) {
			var ou = { uTime: { value: 0 }, uAlpha: { value: 0 }, uFlash: { value: 0 }, uCrack: { value: 0 }, uSeed: { value: i * 1.37 }, uSize: { value: 1.1 }, uIcon: { value: threatIcons }, uCell: { value: new THREE.Vector2() } };
			var orb = new THREE.Mesh(orbGeo, new THREE.ShaderMaterial({
				uniforms: ou, vertexShader: ORB_VS, fragmentShader: ORB_FS, transparent: true, depthWrite: false,
				blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
			}));
			orb.frustumCulled = false; orb.renderOrder = 4; orb.visible = false; grp.add(orb);
			var tg = new THREE.BufferGeometry();
			tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * 6), 3));
			tg.setAttribute('aT', new THREE.BufferAttribute(trailT, 1)); tg.setAttribute('aS', new THREE.BufferAttribute(trailS, 1));
			tg.setIndex(trailIdx);
			var tu = { uAlpha: { value: 0 } };
			var trail = new THREE.Mesh(tg, new THREE.ShaderMaterial({ uniforms: tu, vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
			trail.frustumCulled = false; trail.renderOrder = 3; trail.visible = false; grp.add(trail);
			var flash = new THREE.Sprite(flashMat()); flash.visible = false; flash.renderOrder = 5; grp.add(flash);
			threats.push({ on: false, orb: orb, ou: ou, trail: trail, tu: tu, flash: flash, start: new THREE.Vector3(), ctrl: new THREE.Vector3(), target: new THREE.Vector3(), side: new THREE.Vector3(), t0: 0, dur: 2, heavy: 0, hit: false, wob: 0, phase: 0, r: 0.45 });
		}
		// sparks thrown off each hit
		var SPN = 4 * 18, spPos = new Float32Array(SPN * 3), spCol = new Float32Array(SPN * 3), sparks = [];
		var spGeo = new THREE.BufferGeometry();
		spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
		var spMesh = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.16, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
		spMesh.frustumCulled = false; spMesh.renderOrder = 5; grp.add(spMesh);
		for (i = 0; i < SPN; i++) sparks.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), t0: -100 });

		var UP = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _cam = new THREE.Vector3();
		function normalAt(p, out) { return out.set((p.x - SC.x) / sq(SR.x), p.y / sq(SR.y), (p.z - SC.z) / sq(SR.z)).normalize(); }
		// a spot on the side of the dome facing us that the screen, the text and Burhan don't cover
		function screenRect() {
			var sc = st.screen; if (!sc || !sc.visible) return null;
			var w = sc.userData.w / 2 + 0.3, h = sc.userData.h / 2 + 0.3, r = [1, -1, 1, -1];
			[[-w, -h], [w, -h], [-w, h], [w, h]].forEach(function (q) {
				_c.set(q[0], q[1], 0); sc.localToWorld(_c); _c.project(camera);
				r[0] = Math.min(r[0], _c.x); r[1] = Math.max(r[1], _c.x); r[2] = Math.min(r[2], _c.y); r[3] = Math.max(r[3], _c.y);
			});
			return r;
		}
		function pickTarget(out) {
			var rect = screenRect(), best = null;
			_b.set(person.position.x, 1.0, person.position.z).project(camera);
			var px = _b.x;
			for (var k = 0; k < 16; k++) {
				var el = 0.12 + Math.random() * 0.7, az = (Math.random() - 0.5) * 2.0;
				out.set(SC.x + SR.x * Math.cos(el) * Math.sin(az), SR.y * Math.sin(el), SC.z + SR.z * Math.cos(el) * Math.cos(az));
				_c.copy(out).add(grp.position).project(camera);
				var ok = Math.abs(_c.x) < 0.88 && _c.y < 0.55 && _c.y > (mobile ? -0.05 : -0.5);
				if (ok && rect && _c.x > rect[0] - 0.05 && _c.x < rect[1] + 0.05 && _c.y > rect[2] - 0.05 && _c.y < rect[3] + 0.05) ok = false;
				if (ok && !mobile && _c.x < (lastEx > 0.5 ? 0.3 : -0.2)) ok = false;
				if (ok && Math.abs(_c.x - px) < (mobile ? 0.3 : 0.12) && _c.y < 0.2) ok = false;
				if (ok) return out;
				if (!best) best = out.clone();
			}
			return out.copy(best);
		}
		function launch(t, delay, heavy) {
			var th = null;
			for (var k = 0; k < threats.length; k++) if (!threats[k].on) { th = threats[k]; break; }
			if (!th) return;
			pickTarget(th.target);
			normalAt(th.target, _n);
			var side = _a.crossVectors(_n, UP).normalize();
			// come in from the sky off to one side, starting inside the frame so the whole run is seen
			for (k = 0; k < 8; k++) {
				var lat = (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.5), dist = (5.5 + Math.random() * 2.5) * (1 - k * 0.1) * (mobile ? 0.6 : 1);
				th.start.copy(th.target).addScaledVector(_n, 0.6 * dist).addScaledVector(UP, 0.32 * dist).addScaledVector(side, lat * dist);
				_c.copy(th.start).add(grp.position).project(camera);
				if (Math.abs(_c.x) < 0.92 && _c.y < 0.7 && _c.z < 1) break;
			}
			// no room above it: come in level from the side instead, never from under the header
			if (k === 8) th.start.copy(th.target).addScaledVector(_n, 1.2).addScaledVector(side, (_c.x > 0 ? -1 : 1) * 2.4);
			var len = th.start.distanceTo(th.target), curve = (Math.random() - 0.5) * 0.3;
			th.side.copy(side);
			th.ctrl.copy(th.start).lerp(th.target, 0.45).addScaledVector(side, curve * len).addScaledVector(UP, Math.abs(curve) * 0.35 * len);
			th.heavy = heavy ? 1 : 0;
			th.r = heavy ? 0.52 : 0.33 + Math.random() * 0.06;
			th.ou.uSize.value = th.r * 2 / 0.78;
			th.ou.uCell.value.set(Math.floor(Math.random() * 4), Math.floor(Math.random() * 2));
			th.wob = 0.35 * th.r; th.phase = Math.random() * 6.28;
			th.t0 = t + delay; th.dur = (heavy ? 2.9 : 1.9 + Math.random() * 0.7);
			th.on = true; th.hit = false;
		}
		// slow while it acquires its target, then accelerating into the hit
		function ease(u) { return u < 0.22 ? 0.08 * sq(u / 0.22) : 0.08 + 0.92 * Math.pow((u - 0.22) / 0.78, 2.2); }
		function along(th, u, out) {
			var s = ease(Math.min(1, Math.max(0, u))), o = 1 - s;
			out.set(0, 0, 0).addScaledVector(th.start, o * o).addScaledVector(th.ctrl, 2 * o * s).addScaledVector(th.target, s * s);
			return out.addScaledVector(th.side, Math.sin(u * Math.PI * 2.4 + th.phase) * th.wob * o * o);
		}
		var nextAttack = 0;
		function hit(th, t) {
			// reuse the oldest of the four impact slots
			var k = 0;
			for (var j0 = 1; j0 < 4; j0++) if (shieldU.uImp.value[j0].w < shieldU.uImp.value[k].w) k = j0;
			shieldU.uImp.value[k].set(th.target.x - SC.x, th.target.y - SC.y, th.target.z - SC.z, t);
			shieldU.uImpP.value[k].set(1, th.heavy ? 0.95 : 0.7, th.heavy, Math.random());
			normalAt(th.target, _n);
			var base0 = threats.indexOf(th) * 18;
			for (var j = 0; j < 18; j++) {
				var sp = sparks[base0 + j];
				sp.p.copy(th.target); sp.t0 = t;
				sp.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(5).addScaledVector(_n, 2.5 + Math.random() * 2);
			}
		}
		function reset() {
			threats.forEach(function (th) { th.on = false; th.orb.visible = th.trail.visible = th.flash.visible = false; });
			shieldU.uTgt.value.forEach(function (v) { v.w = 0; });
			nextAttack = 0;
		}
		st.hide = reset;

		// the ride pod, the metro and the flying cars from the 360 VR film
		var pod = new THREE.Group(), podBody = new THREE.Group(), podLights = new THREE.Group(), metro = new THREE.Group(), cars = [];
		pod.rotation.order = 'YXZ'; pod.add(podBody); grp.add(pod); grp.add(podLights);
		// lit from our side whichever way it is facing
		var podGlow = new THREE.PointLight(0x7ffff0, 0, 6, 2); podGlow.position.set(0.3, 0.2, 1.2); podLights.add(podGlow);
		var podFill = new THREE.PointLight(0xffffff, 0, 7, 2); podFill.position.set(1.5, 1.4, 2.6); podLights.add(podFill);
		// thrusters under the back of the pod (its nose is -z)
		var thrust = [];
		[-0.6, 0.6].forEach(function (x) {
			var f = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x5ffff0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
			f.position.set(x, -1.15, 1.4); podBody.add(f); thrust.push(f);
		});
		var _fp = new THREE.Vector3(), _fq = new THREE.Vector3();
		// move along a loop at an even speed, facing the way it flies, pitching with
		// the climb and banking into the turn; fwd is the model's nose (+z or -z)
		function flyLoop(o, P, dt, fwd, lift) {
			P.a += P.dir * P.v * dt / Math.max(0.3, Math.sqrt(sq(P.rx * Math.sin(P.a)) + sq(P.rz * Math.cos(P.a))));
			flyAt(P, P.a, _fp); flyAt(P, P.a + P.dir * 0.02, _fq).sub(_fp);
			var yaw = Math.atan2(fwd * _fq.x, fwd * _fq.z);
			if (P.yaw !== undefined && dt > 0) {
				var dy = yaw - P.yaw; dy = ((dy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
				P.bank = damp(P.bank || 0, Math.max(-0.32, Math.min(0.32, dy / dt * 0.25)), 3, dt);
			}
			P.yaw = yaw;
			o.position.set(_fp.x, _fp.y - lift, _fp.z);
			o.rotation.set(-fwd * Math.atan2(_fq.y, Math.sqrt(_fq.x * _fq.x + _fq.z * _fq.z)), yaw, -fwd * (P.bank || 0));
		}
		var ringPts = [], ringLen = [0], RN = 240;
		for (var a1 = 0; a1 <= RN; a1++) {
			var an = a1 / RN * Math.PI * 2;
			ringPts.push(new THREE.Vector3(RING.x + Math.cos(an) * RING.rx, RING.y - RING.tilt * Math.sin(an), RING.z + Math.sin(an) * RING.rz));
			if (a1) ringLen.push(ringLen[a1 - 1] + ringPts[a1].distanceTo(ringPts[a1 - 1]));
		}
		var RING_L = ringLen[RN];
		function ringAt(d, out) {
			d = ((d % RING_L) + RING_L) % RING_L;
			var lo = 0, hi = RN;
			while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (ringLen[mid] <= d) lo = mid; else hi = mid; }
			return out.copy(ringPts[lo]).lerp(ringPts[hi], (d - ringLen[lo]) / (ringLen[hi] - ringLen[lo]));
		}
		// the ring and its pillars grow up out of the ground together
		var ringGrp = new THREE.Group(); grp.add(ringGrp);
		var railMat = new THREE.MeshStandardMaterial({ color: 0x0a1416, emissive: 0x2ad6b4, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.5 });
		ringGrp.add(new THREE.Mesh(new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(ringPts.slice(0, RN), true), RN, 0.06, 6, true), railMat));
		var pillarGeo = new THREE.CylinderBufferGeometry(0.035, 0.05, 1, 6), pillarMat = std(0x0d1c1e, { metalness: 0.6, roughness: 0.4 });
		for (var k1 = 0; k1 < 14; k1++) {
			var pp = ringAt(k1 / 14 * RING_L, new THREE.Vector3());
			var pl = new THREE.Mesh(pillarGeo, pillarMat); pl.position.set(pp.x, pp.y / 2, pp.z); pl.scale.y = pp.y; ringGrp.add(pl);
		}
		// the train from the film is skinned along its length, so it bends round the ring
		var TRAIN = 0.13, trainBones = [], _rq = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _ry = new THREE.Vector3(0, 1, 0), _rz = new THREE.Vector3(0, 0, 1), _rp = new THREE.Vector3(), _rp2 = new THREE.Vector3();
		metro.scale.setScalar(TRAIN); grp.add(metro);
		// yaw turns each car's own length onto +z, undoing the angle it was parked at in the film's scene
		var CARS = [{ n: 'carA', c: [-879.59, 4.47, 584.64], len: 39.5, yaw: 0.4846 }, { n: 'carB', c: [-1077.0, 4.47, 963.4], len: 32.5, yaw: -2.668 }];
		st.lazy = function () {
			loadModel('media/models/cockpit.glb', function (m) {
				// centre it so it banks around its middle
				m.position.set(-0.56, -1.1, 0.2);
				m.traverse(function (o) { if (o.isMesh && o.material) { o.material.metalness = Math.min(o.material.metalness, 0.5); o.material.roughness = Math.max(o.material.roughness, 0.35); } });
				podBody.add(m);
			});
			loadModel('media/models/metro.glb', function (m) {
				m.traverse(function (o) {
					if (o.isBone && /^bone_\d+$/.test(o.name)) trainBones.push({ b: o, x: o.position.x, q: o.quaternion.clone() });
					// lit from inside, so it reads as a moving band of light against the sky
					if (o.isMesh && o.material && o.material.map) { o.material.emissive = new THREE.Color(0x9ff6ff); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0.7; }
				});
				metro.add(m);
			});
			CARS.forEach(function (cd, k) {
				loadModel('media/models/cars.glb', function (m) {
					var piv = new THREE.Group(), keep = null;
					// carB is a group of meshes, carA a single mesh
					m.traverse(function (o) { if (o.name === cd.n && !keep) keep = o; });
					m.traverse(function (o) { if (o.isMesh) { var p = o; var mine = false; while (p) { if (p === keep) mine = true; p = p.parent; } o.visible = mine; } });
					m.position.set(-cd.c[0], -cd.c[1], -cd.c[2]);
					piv.add(m); piv.scale.setScalar(3.0 / cd.len); piv.rotation.y = cd.yaw;
					var holder = new THREE.Group(); holder.rotation.order = 'YXZ'; holder.add(piv); grp.add(holder);
					cars.push({ o: holder, P: k ? FLY.carB : FLY.carA });
				});
			});
		};
		st.update = function (t, life, dt) {
			// the pod and the cars climb up into their loops as the city rises
			var fly = easeOut(smooth(0.3, 0.85, life)), lift = (1 - fly) * 2.5;
			pod.visible = podBody.children.length > 2 && fly > 0.01;
			podBody.scale.setScalar(Math.max(0.001, fly) * (mobile ? 0.42 : 0.7));
			flyLoop(pod, FLY.pod, dt, -1, lift);
			podLights.position.copy(pod.position);
			podGlow.intensity = 3.0 * smooth(0.4, 1, life);
			podFill.intensity = 1.6 * smooth(0.4, 1, life);
			thrust.forEach(function (f, j) { f.material.opacity = fly * (0.75 + 0.25 * Math.sin(t * 17 + j)); f.lookAt(camera.position); });
			var kr = smooth(0.2, 0.7, life); ringGrp.scale.set(1, Math.max(0.001, kr), 1); ringGrp.visible = kr > 0.01;
			metro.visible = kr > 0.98 && trainBones.length > 0;
			if (metro.visible) {
				var head = t * 2.4;
				trainBones.forEach(function (tb) {
					var d = head + tb.x * TRAIN;
					ringAt(d, _rp); ringAt(d + 0.05, _rp2).sub(_rp);
					// turn with the track, and pitch up and down its slope
					_rq.setFromAxisAngle(_ry, Math.atan2(-_rp2.z, _rp2.x));
					_rq2.setFromAxisAngle(_rz, Math.atan2(_rp2.y, Math.sqrt(_rp2.x * _rp2.x + _rp2.z * _rp2.z)));
					tb.b.quaternion.copy(_rq).multiply(_rq2).multiply(tb.q);
					tb.b.position.set(_rp.x / TRAIN, (_rp.y + 0.06 + 1.01 * TRAIN) / TRAIN, _rp.z / TRAIN);
				});
			}
			cars.forEach(function (c) {
				flyLoop(c.o, c.P, dt, 1, lift);
				c.o.scale.setScalar(Math.max(0.001, fly) * (mobile ? 0.7 : 1));
				c.o.visible = fly > 0.01;
			});
			towers.forEach(function (m, j) { var k = smooth(j / 60, j / 60 + 0.5, life); m.scale.set(1, Math.max(0.001, k), 1); m.position.y = m.userData.h * k / 2; });
			var kb = smooth(0.2, 0.8, life); burj.scale.set(1, Math.max(0.001, kb) * 0.84, 1);
			city.visible = life > 0.01;

			// the shield rises once the city is up, then threats start coming in
			var ks = smooth(0.35, 0.95, life);
			dome.visible = ks > 0.001;
			shieldU.uTime.value = t; shieldU.uLife.value = ks; shieldU.uReveal.value = ks >= 0.999 ? 1.01 : ks;
			if (dome.visible) { var hr = screenRect(); if (hr) shieldU.uHole.value.set(hr[0], hr[1], hr[2], hr[3]); else shieldU.uHole.value.set(9, 9, 9, 9); renderer.getDrawingBufferSize(shieldU.uRes.value); }
			base.material.opacity = 0.75 * ks;
			if (life > 0.85 && t > nextAttack) {
				var r = Math.random();
				if (r < 0.5) launch(t, 0, Math.random() < 0.12);
				else if (r < 0.75) { launch(t, 0, false); launch(t, 0.3, false); }
				else if (r < 0.9) { launch(t, 0, false); launch(t, 0.25, false); launch(t, 0.5, false); }
				else launch(t, 0, true);
				nextAttack = t + 1.6 + Math.random() * 1.4;
			}
			if (life < 0.5 && nextAttack) reset();
			grp.worldToLocal(_cam.copy(camera.position));
			threats.forEach(function (th, k) {
				var tgt = shieldU.uTgt.value[k];
				if (!th.on) { tgt.w = 0; return; }
				var u = (t - th.t0) / th.dur;
				th.ou.uTime.value = t;
				if (u < 0) { th.orb.visible = th.trail.visible = false; return; }
				if (u < 1) {
					along(th, u, th.orb.position);
					th.orb.visible = true;
					th.ou.uAlpha.value = smooth(0, 0.12, u); th.ou.uFlash.value = 0; th.ou.uCrack.value = 0;
					tgt.set(th.target.x - SC.x, th.target.y - SC.y, th.target.z - SC.z, smooth(0.35, 1, u));
					// trail: the path just behind the orb, as a ribbon facing the camera
					var pos = th.trail.geometry.attributes.position, arr = pos.array;
					for (var j = 0; j < M; j++) {
						along(th, u - j * 0.022, _a);
						along(th, u - j * 0.022 + 0.01, _b);
						_b.sub(_a); _c.copy(_cam).sub(_a); _b.cross(_c).normalize().multiplyScalar(th.r * 0.62 * (1 - j / M));
						arr[j * 6] = _a.x - _b.x; arr[j * 6 + 1] = _a.y - _b.y; arr[j * 6 + 2] = _a.z - _b.z;
						arr[j * 6 + 3] = _a.x + _b.x; arr[j * 6 + 4] = _a.y + _b.y; arr[j * 6 + 5] = _a.z + _b.z;
					}
					pos.needsUpdate = true;
					th.trail.visible = true; th.tu.uAlpha.value = smooth(0.05, 0.4, u);
					return;
				}
				if (!th.hit) { th.hit = true; tgt.w = 0; hit(th, t); }
				var a = t - th.t0 - th.dur;
				th.orb.position.copy(th.target);
				th.ou.uFlash.value = 3 * Math.max(0, 1 - a / 0.3);
				th.ou.uCrack.value = smooth(0, 0.3, a);
				th.ou.uAlpha.value = 1 - smooth(0.12, 0.32, a);
				th.tu.uAlpha.value = Math.max(0, 1 - a / 0.15);
				th.flash.visible = a < 0.4;
				th.flash.position.copy(th.target);
				th.flash.scale.setScalar((th.heavy ? 1.6 : 1) * (0.8 + easeOut(Math.min(1, a / 0.4)) * 2.8));
				th.flash.material.opacity = Math.max(0, 1 - a / 0.4);
				if (a > 0.45) { th.on = false; th.orb.visible = th.trail.visible = th.flash.visible = false; }
			});
			for (var s2 = 0; s2 < SPN; s2++) {
				var sp = sparks[s2], age = t - sp.t0, kf = age >= 0 && age < 0.7 ? 1 - age / 0.7 : 0;
				if (kf > 0) { sp.p.addScaledVector(sp.v, dt); sp.v.multiplyScalar(1 - 2.2 * dt); sp.v.y -= 3 * dt; }
				spPos[s2 * 3] = sp.p.x; spPos[s2 * 3 + 1] = sp.p.y; spPos[s2 * 3 + 2] = sp.p.z;
				spCol[s2 * 3] = kf * 1.0; spCol[s2 * 3 + 1] = kf * kf * 0.55; spCol[s2 * 3 + 2] = kf * kf * 0.3;
			}
			spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
		};
	};

	// Madinat Jumeirah MR: glass panels float around a model of the venue on
	// a glowing pedestal, as they do in the headset.
	BUILD.mr = function (st, grp) {
		st.floorKey = 'tiles'; st.floorAt = [0.8, -3.2];
		var ped = new THREE.Group();
		var base = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.55, 0.6, 0.9, 48), new THREE.MeshStandardMaterial({ color: 0x2a6dff, emissive: 0x1a4dff, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, roughness: 0.2 }));
		base.position.y = 0.45; ped.add(base);
		var venue = new THREE.Group(), vm = std(0xd9b98a, { roughness: 0.6, emissive: 0x3a2a12, emissiveIntensity: 0.5 }), roof = std(0x8b97a3, { metalness: 0.5, roughness: 0.4 });
		[[0, 0, 0.9, 0.18, 0.6, vm], [0, 0.14, 0.82, 0.04, 0.52, roof], [-0.36, 0.05, 0.2, 0.26, 0.2, vm], [0.36, 0.05, 0.2, 0.26, 0.2, vm], [0, 0.2, 0.3, 0.05, 0.3, roof]].forEach(function (b) {
			var m = new THREE.Mesh(new THREE.BoxBufferGeometry(b[2], b[3], b[4]), b[5]); m.position.set(b[0], b[1] + b[3] / 2, 0); venue.add(m);
		});
		for (var r = 0; r < 4; r++) for (var c = 0; c < 7; c++) { var seat = new THREE.Mesh(new THREE.BoxBufferGeometry(0.06, 0.02, 0.06), roof); seat.position.set(-0.27 + c * 0.09, 0.2, -0.18 + r * 0.12); venue.add(seat); }
		venue.position.y = 0.95; venue.scale.setScalar(1.3); ped.add(venue);
		ped.position.set(-1.5, 0, -4.2); grp.add(ped);
		var glass = new THREE.MeshStandardMaterial({ color: 0xbfd6ff, transparent: true, opacity: 0, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false, emissive: 0x24324a, emissiveIntensity: 0.5 });
		var panels = [];
		[[-0.2, 2.5, -5.6, 1.5, 0.9, 0.5], [1.0, 1.4, -4.6, 0.9, 0.6, -0.3], [-2.9, 2.3, -6.2, 1.1, 0.7, 0.7]].forEach(function (d, j) {
			var pnl = new THREE.Group();
			var pane = new THREE.Mesh(new THREE.PlaneBufferGeometry(d[3], d[4]), glass); pnl.add(pane);
			var edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneBufferGeometry(d[3], d[4])), new THREE.LineBasicMaterial({ color: 0xffe1b8, transparent: true, opacity: 0 }));
			pnl.add(edge);
			for (var k = 0; k < 3; k++) { var bar = new THREE.Mesh(new THREE.PlaneBufferGeometry(d[3] * (0.7 - k * 0.15), 0.035), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); bar.position.set(-d[3] * 0.1, d[4] * 0.25 - k * 0.12, 0.005); pnl.add(bar); }
			pnl.position.set(d[0], d[1], d[2]); pnl.rotation.y = d[5];
			pnl.userData = { y: d[1], j: j }; grp.add(pnl); panels.push(pnl);
		});
		var spin = 0;
		st.onMouseMove = function (dd) { spin += dd * 8; };
		st.update = function (t, life, dt) {
			var k = smooth(0.05, 0.6, life);
			ped.scale.setScalar(Math.max(0.001, k)); ped.visible = k > 0.01;
			spin += dt * 0.4; venue.rotation.y = spin;
			var kp = smooth(0.4, 1, life);
			glass.opacity = 0.22 * kp;
			panels.forEach(function (p) {
				p.position.y = p.userData.y + Math.sin(t * 0.9 + p.userData.j * 2) * 0.06;
				p.children.forEach(function (c, i) { if (i > 0) c.material.opacity = (i === 1 ? 0.8 : 0.6) * kp; });
				p.visible = kp > 0.01;
			});
		};
	};

	BUILD.galaxy = function (st, grp) {
		st.floorKey = 'water'; st.floorAt = [0.8, -3.0];
		st.rise = false;
		var n = coarse ? 3500 : 9000;
		var r = new Float32Array(n), a = new Float32Array(n), h = new Float32Array(n), sz = new Float32Array(n), pos = new Float32Array(n * 3);
		for (var i = 0; i < n; i++) {
			r[i] = Math.pow(Math.random(), 0.7) * 2.8; a[i] = (i % 3) * (Math.PI * 2 / 3) + (Math.random() - 0.5) * 0.9; h[i] = (Math.random() - 0.5); sz[i] = 0.5 + Math.random();
		}
		var geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		geo.setAttribute('aR', new THREE.BufferAttribute(r, 1));
		geo.setAttribute('aA', new THREE.BufferAttribute(a, 1));
		geo.setAttribute('aH', new THREE.BufferAttribute(h, 1));
		geo.setAttribute('aS', new THREE.BufferAttribute(sz, 1));
		var mat = new THREE.ShaderMaterial({
			uniforms: { uMorph: { value: 0 }, uLife: { value: 0 }, uSpin: { value: 0 }, uPR: { value: renderer.getPixelRatio() } },
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
			vertexShader: [
				'attribute float aR; attribute float aA; attribute float aH; attribute float aS;',
				'uniform float uMorph; uniform float uLife; uniform float uSpin; uniform float uPR;',
				'varying float vR; varying float vA;',
				'void main(){',
				'  float ang = aA * mix(3.0, 1.0, uMorph) + aR * 2.4 * uMorph + uSpin / (0.35 + aR);',
				'  float rad = aR * (0.35 + 0.65 * uLife);',
				'  vec3 p = vec3(cos(ang) * rad, aH * mix(2.6, 0.18, uMorph) * (1.0 - aR * 0.25), sin(ang) * rad);',
				'  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
				'  gl_Position = projectionMatrix * mv;',
				'  gl_PointSize = aS * uPR * 22.0 / -mv.z;',
				'  vR = aR; vA = uLife;',
				'}'
			].join('\n'),
			fragmentShader: [
				'varying float vR; varying float vA;',
				'void main(){',
				'  float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;',
				'  float k = smoothstep(0.5, 0.0, d);',
				'  vec3 c = mix(vec3(0.85, 0.95, 1.0), vec3(0.15, 0.45, 1.0), smoothstep(0.0, 2.2, vR));',
				'  gl_FragColor = vec4(c * k * 0.55 * vA, 1.0);',
				'}'
			].join('\n')
		});
		var pts = new THREE.Points(geo, mat);
		pts.frustumCulled = false;
		pts.position.set(0.3, 1.7, -2.4);
		pts.rotation.x = 0.35;
		grp.add(pts);
		var spin = 0;
		st.update = function (t, life, dt) {
			spin += dt * (0.5 + Math.min(3, st.energy || 0));
			st.energy = (st.energy || 0) * Math.exp(-dt * 1.5);
			mat.uniforms.uSpin.value = spin;
			mat.uniforms.uLife.value = life;
			mat.uniforms.uMorph.value = smooth(0.2, 1.0, life);
			pts.visible = life > 0.01;
		};
		st.onMouseMove = function (d) { st.energy = Math.min(4, (st.energy || 0) + d * 6); };
	};

	BUILD.anatomy = function (st, grp) {
		st.floorKey = 'grid'; st.floorAt = [0.6, -3.0];
		var geo = new THREE.SphereBufferGeometry(0.5, 128, 90);
		var p = geo.attributes.position, v = new THREE.Vector3();
		for (var i = 0; i < p.count; i++) {
			v.fromBufferAttribute(p, i).normalize();
			var folds = 0.045 * Math.sin(14 * v.x + 3 * Math.sin(9 * v.y)) * Math.sin(13 * v.y + 2 * Math.cos(8 * v.z)) + 0.03 * Math.sin(17 * v.z + 4 * Math.sin(6 * v.x));
			var groove = -0.09 * Math.exp(-v.x * v.x * 160) * (v.y > -0.35 ? 1 : 0);
			var rr = 0.5 + folds + groove;
			p.setXYZ(i, v.x * rr * 0.92, v.y * rr * 0.8 + (v.y < -0.4 ? 0.05 : 0), v.z * rr * 1.18);
		}
		geo.computeVertexNormals();
		var brain = new THREE.Mesh(geo, std(0xe39a98, { roughness: 0.5, emissive: 0x3a0a10, emissiveIntensity: 0.4 }));
		var holder = new THREE.Group();
		holder.add(brain);
		grp.add(holder);
		var lg = new THREE.BufferGeometry();
		var lp = new Float32Array(6); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
		var laser = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0 }));
		laser.frustumCulled = false;
		scene.add(laser);
		var dot = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.35, 0.35), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff2a3a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
		scene.add(dot);
		// these live in world space, so hide them whenever the stop is out of view
		laser.visible = dot.visible = false;
		st.hide = function () { laser.visible = dot.visible = false; };
		var hand = new THREE.Vector3(), target = new THREE.Vector3();
		var rx = 0, ry = 0;
		st.update = function (t, life, dt) {
			var k = smooth(0.1, 0.9, life);
			// it floats on his right-hand side, between him and the text, clear of the monitor
			holder.scale.setScalar(Math.max(0.001, k) * (mobile ? 1 : 1.25));
			holder.visible = k > 0.005;
			holder.position.set(mobile ? -1.5 : -1.45, (mobile ? 2.0 : 2.05) + Math.sin(t * 1.3) * 0.06, mobile ? -4.0 : -3.8);
			ry = damp(ry, mouse.x * 1.4 + t * 0.15, 3, dt);
			rx = damp(rx, -mouse.y * 0.6, 3, dt);
			brain.rotation.set(rx, ry, 0);
			handWorld(hand);
			holder.getWorldPosition(target);
			target.x += 0.3; target.y -= 0.1; target.z += 0.2;
			lp[0] = hand.x; lp[1] = hand.y; lp[2] = hand.z; lp[3] = target.x; lp[4] = target.y; lp[5] = target.z;
			lg.attributes.position.needsUpdate = true;
			var on = smooth(0.6, 0.95, life);
			laser.material.opacity = on * (0.75 + 0.25 * Math.sin(t * 20));
			laser.visible = on > 0.01;
			dot.position.copy(target); dot.lookAt(camera.position);
			dot.material.opacity = on; dot.visible = on > 0.01;
		};
	};

	BUILD.road = function (st, grp) {
		st.floorKey = 'road'; st.floorAt = [1.0, -3.4];
		var g = new THREE.Group(); g.position.set(1.2, 0, -4.4); grp.add(g);
		var green = std(0x5fd35a, { roughness: 0.7 }), brick = std(0xa2564a, { roughness: 0.9 });
		function platform(x) {
			var p = new THREE.Group();
			var b = new THREE.Mesh(new THREE.BoxBufferGeometry(1.3, 0.9, 0.7), brick); b.position.y = 0.45; p.add(b);
			var t = new THREE.Mesh(new THREE.BoxBufferGeometry(1.34, 0.08, 0.72), green); t.position.y = 0.92; p.add(t);
			p.position.x = x; g.add(p); return p;
		}
		platform(-2.1); platform(2.1);
		var spikeMat = std(0xb9bec8, { metalness: 0.7, roughness: 0.3 });
		for (var k = 0; k < 7; k++) { var sp = new THREE.Mesh(new THREE.ConeBufferGeometry(0.07, 0.22, 8), spikeMat); sp.position.set(-0.9 + k * 0.3, 0.11, 0); g.add(sp); }
		var flag = new THREE.Mesh(new THREE.BoxBufferGeometry(0.22, 0.14, 0.01), std(0x2fd34a, { emissive: 0x0f5a1a }));
		flag.position.set(2.3, 1.38, 0); g.add(flag);
		var pole = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.01, 0.01, 0.5, 6), std(0xdddddd)); pole.position.set(2.18, 1.2, 0); g.add(pole);
		var curve = new THREE.CatmullRomCurve3([
			new THREE.Vector3(-1.45, 0.97, 0), new THREE.Vector3(-0.8, 0.82, 0), new THREE.Vector3(-0.2, 0.58, 0),
			new THREE.Vector3(0.45, 0.68, 0), new THREE.Vector3(1.0, 0.9, 0), new THREE.Vector3(1.45, 0.97, 0)
		]);
		var SEG = 140, RAD = 6;
		var tube = new THREE.Mesh(new THREE.TubeBufferGeometry(curve, SEG, 0.035, RAD, false), std(0xff8a1f, { emissive: 0xff5a00, emissiveIntensity: 0.8 }));
		g.add(tube);
		var car = new THREE.Group();
		var bodyM = std(0xd8322b, { roughness: 0.35, metalness: 0.2 });
		var cb = new THREE.Mesh(new THREE.BoxBufferGeometry(0.34, 0.09, 0.16), bodyM); cb.position.y = 0.1; car.add(cb);
		var cab = new THREE.Mesh(new THREE.BoxBufferGeometry(0.16, 0.08, 0.14), bodyM); cab.position.set(-0.03, 0.18, 0); car.add(cab);
		var wheels = [];
		[-0.11, 0.11].forEach(function (x) {
			var w = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.055, 0.055, 0.18, 16), std(0x111111));
			w.rotation.x = Math.PI / 2; w.position.set(x, 0.055, 0); car.add(w); wheels.push(w);
		});
		g.add(car);
		var blade = new THREE.Group();
		blade.position.set(0.15, 2.3, 0.15);
		var arm = new THREE.Mesh(new THREE.BoxBufferGeometry(0.03, 1.0, 0.03), std(0x6b4a2f)); arm.position.y = -0.5; blade.add(arm);
		var disc = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.3, 0.3, 0.03, 28, 1, false, 0, Math.PI), std(0xc9ced6, { metalness: 0.8, roughness: 0.25 }));
		disc.rotation.x = Math.PI / 2; disc.rotation.y = Math.PI / 2; disc.position.y = -1.0; blade.add(disc);
		g.add(blade);
		var drive = 0;
		st.update = function (t, life, dt) {
			var k = smooth(0.0, 0.3, life);
			g.position.y = -(1 - easeOut(k)) * 2.6;
			g.visible = k > 0.005;
			var draw = smooth(0.35, 0.85, life);
			tube.geometry.setDrawRange(0, Math.floor(SEG * draw) * RAD * 6);
			blade.rotation.z = Math.sin(t * 2.0) * 0.75 * k;
			var u;
			if (draw >= 0.999) { drive = (drive + dt / 2.6) % 1.35; u = Math.min(1, drive); }
			else { drive = 0; u = 0; }
			if (u <= 0) { car.position.set(-1.75, 0.96, 0); car.rotation.z = 0; }
			else {
				var pt = curve.getPointAt(u), tg = curve.getTangentAt(u);
				car.position.set(pt.x, pt.y + 0.02, 0); car.rotation.z = Math.atan2(tg.y, tg.x);
			}
			wheels.forEach(function (w) { w.rotation.y -= dt * 10 * (u > 0 && u < 1 ? 1 : 0); });
		};
	};

	BUILD.drift = function (st, grp) {
		st.floorKey = 'road'; st.floorAt = [1.4, -4.2];
		var g = new THREE.Group(); g.position.set(1.2, 0, -5.4); grp.add(g);
		// a small low-poly car, extruded from its side profile
		var shape = new THREE.Shape();
		shape.moveTo(-0.36, 0.06); shape.lineTo(0.36, 0.06); shape.lineTo(0.38, 0.16); shape.lineTo(0.3, 0.2);
		shape.lineTo(0.14, 0.21); shape.lineTo(0.06, 0.32); shape.lineTo(-0.2, 0.32); shape.lineTo(-0.3, 0.22); shape.lineTo(-0.37, 0.2); shape.closePath();
		var bodyGeo = new THREE.ExtrudeBufferGeometry(shape, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 });
		bodyGeo.translate(0, 0, -0.14);
		var car = new THREE.Group();
		car.add(new THREE.Mesh(bodyGeo, std(0x2f63ff, { roughness: 0.25, metalness: 0.45 })));
		var glass = new THREE.Mesh(new THREE.BoxBufferGeometry(0.22, 0.08, 0.3), std(0x0b1220, { roughness: 0.1, metalness: 0.8 }));
		glass.position.set(-0.07, 0.26, 0); car.add(glass);
		var tail = new THREE.Mesh(new THREE.BoxBufferGeometry(0.02, 0.04, 0.24), new THREE.MeshBasicMaterial({ color: 0xff2a2a })); tail.position.set(-0.385, 0.15, 0); car.add(tail);
		var head = new THREE.Mesh(new THREE.BoxBufferGeometry(0.02, 0.03, 0.24), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })); head.position.set(0.385, 0.13, 0); car.add(head);
		[[-0.22, 0.15], [0.22, 0.15], [-0.22, -0.15], [0.22, -0.15]].forEach(function (w) {
			var wh = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.07, 0.07, 0.06, 16), std(0x111111)); wh.rotation.x = Math.PI / 2; wh.position.set(w[0], 0.07, w[1]); car.add(wh);
		});
		g.add(car);
		var M = 220, trail = [new Float32Array(M * 3), new Float32Array(M * 3)], tgeo = [];
		for (var s = 0; s < 2; s++) {
			var tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(trail[s], 3));
			tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
			var ln = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
			ln.frustumCulled = false; g.add(ln); tgeo.push(tg);
		}
		var filled = 0, u = 0, prev = new THREE.Vector3(), cur = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), off = new THREE.Vector3();
		st.update = function (t, life, dt) {
			car.visible = life > 0.02;
			car.scale.setScalar(Math.max(0.001, smooth(0, 0.3, life)) * 1.3);
			u += dt * 0.9 * life;
			var a = 2.3;
			cur.set(a * Math.sin(u), 0, a * Math.sin(u) * Math.cos(u));
			var vx = cur.x - prev.x, vz = cur.z - prev.z;
			if (vx * vx + vz * vz > 1e-8) car.rotation.y = Math.atan2(-vz, vx) + 0.55 * Math.cos(2 * u);
			car.position.copy(cur);
			prev.copy(cur);
			if (life > 0.2) {
				for (var s = 0; s < 2; s++) {
					off.set(-0.3, 0.012, s ? 0.15 : -0.15).applyAxisAngle(up, car.rotation.y).add(cur);
					trail[s].copyWithin(3, 0, (M - 1) * 3);
					trail[s][0] = off.x; trail[s][1] = off.y; trail[s][2] = off.z;
					var col = tgeo[s].attributes.color.array;
					for (var j = 0; j < M; j++) { var f = (1 - j / M) * life; col[j * 3] = 0.75 * f; col[j * 3 + 1] = 0.5 * f; col[j * 3 + 2] = 1.0 * f; }
					tgeo[s].attributes.position.needsUpdate = true; tgeo[s].attributes.color.needsUpdate = true;
				}
				filled = Math.min(M, filled + 1);
				tgeo[0].setDrawRange(0, filled); tgeo[1].setDrawRange(0, filled);
			} else { filled = 0; tgeo[0].setDrawRange(0, 0); tgeo[1].setDrawRange(0, 0); }
		};
	};

	BUILD.shooter = function (st, grp) {
		st.floorKey = 'grid'; st.floorAt = [0.6, -3.4];
		var red = new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0, depthTest: false, fog: false });
		var cross = new THREE.Group();
		cross.add(new THREE.Mesh(new THREE.RingBufferGeometry(0.16, 0.18, 48), red));
		[[0, 0.28, 0.02, 0.14], [0, -0.28, 0.02, 0.14], [0.28, 0, 0.14, 0.02], [-0.28, 0, 0.14, 0.02]].forEach(function (b) {
			var m = new THREE.Mesh(new THREE.PlaneBufferGeometry(b[2], b[3]), red); m.position.set(b[0], b[1], 0); cross.add(m);
		});
		cross.add(new THREE.Mesh(new THREE.CircleBufferGeometry(0.02, 12), red));
		cross.renderOrder = 10;
		grp.add(cross);
		var CZ = -4.0;
		var targets = [];
		for (var i = 0; i < 4; i++) {
			var tg = new THREE.Group();
			tg.add(new THREE.Mesh(new THREE.TorusBufferGeometry(0.22, 0.035, 12, 48), std(0xffffff, { emissive: 0xff4a10, emissiveIntensity: 0.9 })));
			tg.add(new THREE.Mesh(new THREE.CircleBufferGeometry(0.08, 24), new THREE.MeshBasicMaterial({ color: 0xff5a1a })));
			tg.userData.base = new THREE.Vector3(-0.4 + i * 1.2, 1.3 + (i % 2) * 0.9, -4.6 - (i % 3) * 0.6);
			tg.userData.pop = 0;
			tg.position.copy(tg.userData.base);
			grp.add(tg); targets.push(tg);
		}
		var embers = 260, ep = new Float32Array(embers * 3), es = [];
		for (var e = 0; e < embers; e++) { ep[e * 3] = -3 + Math.random() * 8; ep[e * 3 + 1] = Math.random() * 4; ep[e * 3 + 2] = -9 + Math.random() * 5; es.push(Math.random()); }
		var eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
		var emat = new THREE.PointsMaterial({ color: 0xff7a2a, size: 0.045, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
		grp.add(new THREE.Points(eg, emat));
		var aim = new THREE.Vector3(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3(), wp = new THREE.Vector3(), cp = new THREE.Vector3();
		st.onClick = function () {
			if (st.life < 0.5) return;
			cross.getWorldPosition(cp);
			targets.forEach(function (tg) {
				tg.getWorldPosition(wp);
				if (Math.hypot(wp.x - cp.x, wp.y - cp.y) < 0.45 && tg.userData.pop <= 0) { tg.userData.pop = 1; addRipple(wp.x, wp.z, 1.4); }
			});
		};
		st.update = function (t, life, dt) {
			var on = smooth(0.3, 0.8, life);
			red.opacity = on;
			if (mouseSeen && !coarse) {
				plane.constant = -(grp.position.z + CZ);
				ray.setFromCamera(mouse, camera);
				if (ray.ray.intersectPlane(plane, hit)) aim.set(hit.x - grp.position.x, hit.y, CZ);
			} else {
				var k = Math.floor(Math.max(0, t) / 1.6) % targets.length, b = targets[k].position;
				aim.set(b.x, b.y, CZ);
			}
			cross.position.x = damp(cross.position.x, aim.x, 10, dt);
			cross.position.y = damp(cross.position.y, aim.y, 10, dt);
			cross.position.z = CZ;
			cross.lookAt(camera.position);
			targets.forEach(function (tg, i) {
				var p = tg.userData.pop, s = 1;
				if (p > 0) { tg.userData.pop = p - dt * 1.2; s = p > 0.8 ? 1 + (1 - p) * 3 : (p > 0.15 ? 0.001 : 1 - p / 0.15); }
				tg.scale.setScalar(Math.max(0.001, s * on));
				tg.visible = on > 0.01;
				tg.position.y = tg.userData.base.y + Math.sin(t * 1.2 + i) * 0.12;
				tg.lookAt(camera.position);
			});
			emat.opacity = 0.9 * life;
			for (var e = 0; e < embers; e++) { ep[e * 3 + 1] += dt * (0.2 + es[e] * 0.4); ep[e * 3] += Math.sin(t + es[e] * 9) * dt * 0.1; if (ep[e * 3 + 1] > 4.2) ep[e * 3 + 1] = 0; }
			eg.attributes.position.needsUpdate = true;
		};
	};

	BUILD.about = function (st, grp) {
		var tex = loader.load('media/hq/portrait.jpg');
		tex.encoding = THREE.sRGBEncoding;
		var h = 3.1, w = h * 960 / 1200;
		var photo = new THREE.Mesh(new THREE.PlaneBufferGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: 0x111111, fog: false }));
		var holder = new THREE.Group(); holder.add(photo);
		var frame = new THREE.Mesh(new THREE.BoxBufferGeometry(w + 0.1, h + 0.1, 0.08), std(0x0c0c0e, { metalness: 0.5, roughness: 0.4 })); frame.position.z = -0.05; holder.add(frame);
		holder.userData.base = new THREE.Vector3(2.8, 1.3 + h / 2, -6.6);
		holder.userData.h = h;
		holder.rotation.y = -0.12;
		holder.userData.update = function (life) { var b = 0.08 + 0.92 * life; photo.material.color.setRGB(b, b, b); };
		grp.add(holder);
		st.screen = holder;
	};

	BUILD.contact = function (st, grp) {
		st.rise = false;
		var tx = textTex(1024, 256);
		onFont(function () {
			var g = tx.g; g.clearRect(0, 0, 1024, 256);
			g.fillStyle = '#fff'; g.font = '700 190px "Space Grotesk", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
			g.fillText('HELLO', 512, 136); tx.t.needsUpdate = true;
		});
		var m = new THREE.Mesh(new THREE.PlaneBufferGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: tx.t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false }));
		m.rotation.x = -Math.PI / 2; m.position.set(0.3, 0.02, 2.6);
		grp.add(m);
		st.update = function (t, life) { m.visible = !mobile; m.material.opacity = smooth(0.4, 1, life) * (0.75 + 0.25 * Math.sin(t * 2.4)); };
	};

	stops.forEach(function (s, i) { station(i, kinds[i], s); });

	/* ---------- Scroll to distance ---------- */

	var anchors = [], vh = innerHeight, maxScroll = 1;
	function measure() {
		vh = innerHeight;
		maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
		anchors = stops.map(function (s, i) {
			var a = s.offsetTop + s.offsetHeight / 2 - vh / 2;
			if (i === 0) a = 0;
			if (i === N - 1) a = maxScroll;
			return Math.min(a, maxScroll);
		});
	}
	function scrollToS(y) {
		if (y <= anchors[0]) return 0;
		for (var i = 0; i < N - 1; i++) {
			if (y <= anchors[i + 1]) {
				var t = (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]);
				var e = t - 0.7 * Math.sin(2 * Math.PI * t) / (2 * Math.PI);   // linger at stops
				return stopS(i) + S * e;
			}
		}
		return END;
	}
	function jumpTo(i, smooth) {
		setPlaying(false);
		window.scrollTo({ top: anchors[i], behavior: smooth ? 'smooth' : 'auto' });
	}
	[].forEach.call(document.querySelectorAll('a[href^="#"]'), function (a) {
		if (a.closest('dialog') || a.classList.contains('js-work') || a.classList.contains('js-explore')) return;
		a.addEventListener('click', function (e) {
			var id = a.getAttribute('href').slice(1);
			var el = id ? document.getElementById(id) : null;
			if (!el) return;
			var i = stops.indexOf(el);
			if (i < 0) i = stops.indexOf(el.nextElementSibling);
			if (i < 0) return;
			e.preventDefault();
			jumpTo(i, true);
		});
	});
	// from the gallery or a project's details: land just short of it and walk up to it
	walk.goTo = function (stopEl) {
		var i = stops.indexOf(stopEl);
		if (i < 0) return;
		setPlaying(false);
		window.scrollTo(0, Math.round(sToScroll(Math.max(0, stopS(i) - S * 0.55))));
		requestAnimationFrame(function () { window.scrollTo({ top: anchors[i], behavior: 'smooth' }); });
	};

	/* ---------- Clicks in the world ---------- */

	document.querySelector('.stops').addEventListener('click', worldClick);
	// hidden monitors still take part in raycasts, so skip them
	function screenHit() {
		ray.setFromCamera(mouse, camera);
		var hits = ray.intersectObjects(screens, false);
		for (var k = 0; k < hits.length; k++) {
			var o = hits[k].object;
			if (o.parent && o.parent.visible && stations[o.userData.index] && stations[o.userData.index].life > 0.5) return o;
		}
		return null;
	}
	function worldClick(e) {
		if (e.target.closest && e.target.closest('a, button, .panel > *')) return;
		setPointer(e);
		var hit = screenHit();
		if (hit) { openPlayer(hit.userData.stop); return; }
		var near = nearest();
		if (near && near.onClick) near.onClick();
		if (ray.ray.intersectPlane(floorPlane, mouseFloor)) addRipple(mouseFloor.x, mouseFloor.z, 1.3);
	}
	function nearest() {
		var best = null, bd = 1e9;
		stations.forEach(function (s) { var d = Math.abs(s.s - charS); if (d < bd) { bd = d; best = s; } });
		return best;
	}
	var hoverCheck = 0;
	function updateHover() {
		document.body.style.cursor = screenHit() ? 'pointer' : '';
	}

	/* ---------- Timeline ticks: the five chapters ---------- */

	var ticksEl = document.querySelector('.track-ticks');
	var ticks = [];
	stops.forEach(function (s, i) {
		if (!s.hasAttribute('data-gate-year')) return;
		var y = s.getAttribute('data-tick'), el = document.createElement('i');
		el.className = 'track-tick' + (y ? '' : ' is-minor');
		el.style.left = (stopS(i) / END * 100) + '%';
		if (y) {
			el.innerHTML = '<span class="t-year"></span><span class="t-name"></span>';
			el.firstChild.textContent = y;
			el.lastChild.textContent = s.getAttribute('data-gate-label') || '';
		}
		ticksEl.appendChild(el);
		ticks.push({ el: el, s: stopS(i), major: !!y, chapter: s.getAttribute('data-chapter') });
	});
	var majors = ticks.filter(function (tk) { return tk.major; });
	// on a narrow track, drop labels that would collide; the chapter he is in keeps its name
	function spaceTicks() {
		var w = ticksEl.clientWidth, lastYear = -1e9, last = null;
		majors.forEach(function (tk) {
			var x = tk.s / END * w, yr = tk.el.firstChild, nm = tk.el.lastChild;
			var hide = x - lastYear < 34;
			yr.style.visibility = hide ? 'hidden' : '';
			if (!hide) lastYear = x;
			tk.x = x; tk.nw = nm.offsetWidth;
			nm.style.visibility = '';
		});
		majors.forEach(function (tk) {
			if (!tk.nw) return;
			if (last && tk.x - tk.nw / 2 < last.x + last.nw / 2 + 14) {
				if (tk.here) { last.el.lastChild.style.visibility = 'hidden'; last = tk; }
				else tk.el.lastChild.style.visibility = 'hidden';
			} else last = tk;
		});
	}
	spaceTicks();
	window.addEventListener('resize', spaceTicks);
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(spaceTicks);

	/* ---------- Timeline: scrub it like a video, or let it play ---------- */

	var track = document.querySelector('.track');
	var tip = track.querySelector('.track-tip');
	var playBtn = document.querySelector('.hud-play');
	var tipLabels = stops.map(function (s, i) {
		var k = kinds[i];
		var name = k === 'intro' ? 'Start' : k === 'about' ? 'About' : k === 'contact' ? 'Contact' : (s.getAttribute('data-gate-label') || text(s, 'h2'));
		return { year: s.getAttribute('data-year') || '', name: name };
	});
	var scrubbing = false, lastResize = 0, tipTimer = 0;
	window.addEventListener('resize', function () { lastResize = performance.now(); });

	// the inverse of scrollToS: where the page has to be for him to stand at distance s
	function sToScroll(s) {
		if (s <= 0) return 0;
		if (s >= END) return anchors[N - 1];
		var i = Math.min(N - 2, Math.floor(s / S)), e = (s - stopS(i)) / S, lo = 0, hi = 1;
		for (var k = 0; k < 22; k++) {
			var m = (lo + hi) / 2;
			if (m - 0.7 * Math.sin(2 * Math.PI * m) / (2 * Math.PI) < e) lo = m; else hi = m;
		}
		return anchors[i] + (lo + hi) / 2 * (anchors[i + 1] - anchors[i]);
	}
	function seek(s) {
		s = Math.max(0, Math.min(END, s));
		var y = Math.round(sToScroll(s));
		auto.lastY = y;
		window.scrollTo(0, y);
		return s;
	}
	function fracAt(e) {
		var r = track.getBoundingClientRect();
		return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
	}
	// a click within a few pixels of a stop lands exactly on it
	function snapS(f) {
		var s = f * END, i = Math.round(s / S), px = track.clientWidth / END;
		return Math.abs(s - stopS(i)) * px < 9 ? stopS(i) : s;
	}
	function showTip(f) {
		var i = Math.max(0, Math.min(N - 1, Math.round(f * END / S))), lb = tipLabels[i];
		tip.firstChild.textContent = lb.year;
		tip.lastChild.textContent = lb.name;
		var r = track.getBoundingClientRect(), w = tip.offsetWidth, x = f * r.width;
		x = Math.max(w / 2 + 8 - r.left, Math.min(innerWidth - 8 - w / 2 - r.left, x));
		tip.style.left = x + 'px';
		tip.classList.add('is-on');
	}
	function hideTip() { tip.classList.remove('is-on'); }

	track.addEventListener('pointerdown', function (e) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		e.preventDefault();
		track.focus({ preventScroll: true });
		scrubbing = true;
		root.classList.add('is-scrubbing');
		try { track.setPointerCapture(e.pointerId); } catch (err) {}
		var f = fracAt(e);
		seek(snapS(f));
		showTip(f);
	});
	track.addEventListener('pointermove', function (e) {
		var f = fracAt(e);
		if (scrubbing) { seek(f * END); showTip(f); }
		else if (e.pointerType === 'mouse') showTip(f);
	});
	function endScrub(e) {
		if (!scrubbing) return;
		scrubbing = false;
		root.classList.remove('is-scrubbing');
		clearTimeout(tipTimer);
		if (e.pointerType !== 'mouse') tipTimer = setTimeout(function () { if (!scrubbing) hideTip(); }, 700);
		else if (e.type !== 'pointerup') hideTip();
		if (auto.on) plan(scrollToS(window.scrollY), false);
	}
	track.addEventListener('pointerup', endScrub);
	track.addEventListener('pointercancel', endScrub);
	track.addEventListener('lostpointercapture', endScrub);
	track.addEventListener('pointerleave', function (e) { if (!scrubbing && e.pointerType === 'mouse') hideTip(); });
	track.addEventListener('keydown', function (e) {
		var cur = scrollToS(window.scrollY) / S, k = e.key, to = -1, ch;
		if (k === 'ArrowRight' || k === 'ArrowUp') to = Math.min(N - 1, Math.floor(cur + 0.05) + 1);
		else if (k === 'ArrowLeft' || k === 'ArrowDown') to = Math.max(0, Math.ceil(cur - 0.05) - 1);
		// a page at a time is a chapter at a time
		else if (k === 'PageDown') { ch = majors.filter(function (tk) { return tk.s > cur * S + 0.5; })[0]; to = ch ? ch.s / S : N - 1; }
		else if (k === 'PageUp') { ch = majors.filter(function (tk) { return tk.s < cur * S - 0.5; }).pop(); to = ch ? ch.s / S : 0; }
		else if (k === 'Home') to = 0;
		else if (k === 'End') to = N - 1;
		if (to < 0) return;
		e.preventDefault();
		seek(stopS(to));
		if (auto.on) plan(stopS(to), false);
	});

	// Autoplay walks stop to stop at an even pace and lingers at each one.
	// It drives the page scroll, so the copy and the 3D stay in step, and any
	// scroll of the user's own takes back control.
	var LEG = 5.2;   // seconds for one stop-to-stop walk
	var auto = { on: false, resume: false, s: 0, from: 0, to: 0, t: 0, dur: 0, dwell: false, lastY: 0 };
	function dwellFor(i) {
		var k = kinds[i];
		return k === 'intro' ? 1.2 : k === 'gate' ? 2.6 : k === 'about' ? 6 : k === 'contact' ? 0 : 6.5;
	}
	// accelerate over the first fifth, an even stride, then ease into the stop
	function trapezoid(u) {
		var a = 0.2, k = 2 * a * (1 - a);
		if (u < a) return u * u / k;
		if (u > 1 - a) return 1 - (1 - u) * (1 - u) / k;
		return (u - a / 2) / (1 - a);
	}
	function plan(s0, fresh) {
		var j = Math.max(0, Math.min(N - 1, Math.ceil(s0 / S - 0.02)));
		auto.t = 0;
		if (Math.abs(s0 - stopS(j)) < S * 0.02) {
			auto.dwell = true;
			auto.s = auto.from = auto.to = stopS(j);
			auto.dur = fresh ? Math.min(0.6, dwellFor(j)) : dwellFor(j);
		} else {
			auto.dwell = false;
			auto.s = auto.from = s0;
			auto.to = stopS(j);
			auto.dur = Math.max(0.9, LEG * (auto.to - s0) / S);
		}
	}
	function stepAuto(dt) {
		auto.t += dt;
		if (auto.dwell) {
			if (auto.t >= auto.dur) {
				var i = Math.round(auto.from / S);
				if (i >= N - 1) { setPlaying(false); return; }
				auto.dwell = false; auto.t = 0;
				auto.to = stopS(i + 1);
				auto.dur = LEG;
			}
		} else {
			var u = Math.min(1, auto.t / auto.dur);
			auto.s = auto.from + (auto.to - auto.from) * trapezoid(u);
			if (u >= 1) {
				auto.dwell = true; auto.t = 0;
				auto.s = auto.from = auto.to;
				auto.dur = dwellFor(Math.round(auto.to / S));
			}
		}
		var y = Math.round(sToScroll(auto.s));
		auto.lastY = y;
		if (Math.abs(y - window.scrollY) >= 1) window.scrollTo(0, y);
	}
	function setPlaying(on) {
		if (on === auto.on) return;
		auto.on = on;
		root.classList.toggle('is-playing', on);
		playBtn.setAttribute('aria-label', on ? 'Pause the walk' : 'Play the walk');
		if (!on) return;
		var s0 = scrollToS(window.scrollY);
		if (s0 >= END - 0.5) { s0 = 0; seek(0); }   // from the end, play again from the start
		plan(s0, true);
		auto.lastY = Math.round(window.scrollY);
	}
	playBtn.addEventListener('click', function () { setPlaying(!auto.on); });
	// Explore my journey: he walks the whole story at an even pace; any scroll takes over
	[].forEach.call(document.querySelectorAll('.js-explore'), function (a) {
		a.addEventListener('click', function (e) { e.preventDefault(); setPlaying(true); });
	});
	walk.pause = function () {
		auto.resume = auto.on; setPlaying(false);
		if (exVideo) exVideo.pause();
	};
	walk.resume = function () {
		if (auto.resume) { auto.resume = false; setPlaying(true); }
		if (exVideo) exVideo.play().catch(function () {});
	};

	// the user's own scrolling pauses it
	function userScroll() { if (auto.on && !scrubbing) { auto.resume = false; setPlaying(false); } }
	window.addEventListener('wheel', function (e) { if (e.deltaY) userScroll(); }, { passive: true });
	window.addEventListener('touchmove', function (e) { if (!(e.target.closest && e.target.closest('.hud'))) userScroll(); }, { passive: true });
	window.addEventListener('keydown', function (e) {
		if (e.target === track || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) return;
		if ([' ', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(e.key) >= 0) userScroll();
	});
	window.addEventListener('scroll', function () {
		// a scroll that is not ours (the scrollbar, a nav link): hand back control
		if (auto.on && !scrubbing && performance.now() - lastResize > 500 && Math.abs(window.scrollY - auto.lastY) > 4) userScroll();
	}, { passive: true });

	/* ---------- Loop ---------- */

	var panels = stops.map(function (s) { return s.querySelector('.panel'); });
	var pv = stops.map(function () { return 0; });
	var isProject = stops.map(function (s) { return s.classList.contains('stop-project'); });
	var hudFill = document.querySelector('.track-fill');
	var hudName = document.querySelector('.hud-name');
	var vignette = document.querySelector('.vignette');
	var navLinks = {};
	[].forEach.call(document.querySelectorAll('.nav nav a'), function (a) { navLinks[a.getAttribute('href')] = a; });
	var lastChapter = null, lastPct = -1, lastNear = -1, lastEx = -1, lastNav = null;
	var charS = 0, lastStepSide = 0, lastT = performance.now();
	var tmpColor = new THREE.Color(), led = new THREE.Color(), bgCol = new THREE.Color(), white = new THREE.Color(1, 1, 1);
	var camRel = new THREE.Vector3(), lookRel = new THREE.Vector3(), _look = new THREE.Vector3();
	var rig = null, rigT = {};
	var running = true;
	var CAM_SHIFT = { intro: -0.9, about: -1.0, contact: -0.4 };
	// on a project the camera slides so he stands near the right edge, clear of the footage and text
	var exShift = -1.4, heroTurn = 0.2;
	// With him at the right edge, a project's scene moves across to stand round him
	// there instead of behind the copy (desktop only; a phone keeps the original layout).
	var DESK_DX = { court: 2.9, tryon: 3.7, anatomy: 3.6, mr: 3.0, shadow: 1.8, water: 1.2, fireworks: 2.6, galaxy: 0.8, forest: 2.0, city: 2.6, tennis: 2.3, shooter: 1.0 };
	var headBone = null;

	function lifeTarget(st, s) {
		var d = s - st.s;
		if (st.portal) return Math.max(smooth(S * 0.7, S * 0.15, Math.abs(d)), 1 - smooth(S * 1.15, S * 1.6, s));
		if (!st.rise) return smooth(S * 0.7, S * 0.15, Math.abs(d));
		// rise as he arrives (everything is behind him by then), fade out once he has moved on
		return smooth(-3.2, -0.4, d) * (1 - smooth(S * 0.5, S * 0.85, d));
	}

	// The exhibit on show plays its clip in the page, muted; every other one
	// keeps its poster and lets go of its video.
	var exVideo = null, exAt = -1;
	function setExhibit(i) {
		if (i === exAt) return;
		if (exVideo) {
			var old = exVideo;
			old.classList.remove('is-on');
			old.pause();
			setTimeout(function () { if (old !== exVideo) unload(old); }, 800);
		}
		exAt = i; exVideo = null;
		if (i < 0) return;
		var fig = panels[i].querySelector('.exhibit-media'), clip = stops[i].getAttribute('data-video');
		if (!fig || !clip) return;
		var v = fig.querySelector('video');
		if (!v) {
			v = document.createElement('video');
			v.muted = true; v.loop = true; v.playsInline = true;
			v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
			v.preload = 'auto';
			v.addEventListener('playing', function () { if (v === exVideo) v.classList.add('is-on'); });
			fig.insertBefore(v, fig.querySelector('.exhibit-play'));
		}
		if (!v.getAttribute('src')) v.src = clip;
		exVideo = v;
		if (!openDialogs) v.play().catch(function () {});
	}

	function resize() {
		var w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
		renderer.setSize(w, h, false);
		if (composer) composer.setSize(w, h);
		camera.aspect = w / h;
		mobile = w < 1000;
		camera.fov = mobile ? 54 : 36;
		if (mobile) camera.setViewOffset(w, h, 0, h * 0.2, w, h); else camera.clearViewOffset();
		camera.updateProjectionMatrix();
		var tanH = Math.tan(camera.fov * Math.PI / 360) * camera.aspect;
		// him at about 80% across on a project, the portal at about 64% in the opening shot
		exShift = 0.95 - 0.6 * 7.4 * tanH;
		heroTurn = Math.atan(0.28 * tanH);
		stations.forEach(function (st) { if (isProject[st.i]) st.group.position.x = pathX(st.s) + (mobile ? 0 : DESK_DX[st.kind] || 0); });
		measure();
	}
	window.addEventListener('resize', resize);
	window.addEventListener('load', measure);
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
	resize();
	// arriving at the top of the page, he walks the last few steps up to his mark
	var walkIn = window.scrollY < 4 && !location.hash ? { t: -1, from: -4.5, dur: 3.4 } : null;
	charS = scrollToS(window.scrollY) + (walkIn ? walkIn.from : 0);

	document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running) { lastT = performance.now(); requestAnimationFrame(frame); } });

	// the camera rig, in polar terms round him so it can swing from behind him to in front
	function rigTo(o, k, a, b) {
		o.az = a.az + (b.az - a.az) * k; o.r = a.r + (b.r - a.r) * k; o.y = a.y + (b.y - a.y) * k;
		o.rel = a.rel + (b.rel - a.rel) * k; o.pitch = a.pitch + (b.pitch - a.pitch) * k; o.L = a.L + (b.L - a.L) * k;
		return o;
	}
	var rigF = {}, rigH = {}, rigX = {}, mouseSm = new THREE.Vector2(), moved = false;

	function frame(now) {
		if (!running) return;
		var dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000));
		lastT = now;
		clock += dt;
		var t = clock;

		if (auto.on && !scrubbing) stepAuto(dt);
		var targetS = auto.on && !scrubbing ? auto.s : scrollToS(window.scrollY);
		if (walkIn) {
			// wait for him to load, then ease in and out of the walk
			if (walkIn.t < 0 && (avatar || clock > 6)) walkIn.t = 0;
			if (walkIn.t >= 0) walkIn.t += dt;
			var wu = smooth(0, walkIn.dur, walkIn.t);
			targetS += walkIn.from * (1 - wu);
			if (walkIn.t >= walkIn.dur) walkIn = null;
		}
		// a jump across several stops (a nav link, a click on the timeline) skips ahead instead of sprinting
		if (Math.abs(targetS - charS) > S * 2.5) charS = targetS - Math.sign(targetS - charS) * S * 0.9;
		var prevS = charS;
		charS = damp(charS, targetS, scrubbing ? 6 : 2.8, dt);
		var ds = charS - prevS;
		// how hard he is walking, from how fast he covers ground
		var speed = Math.abs(ds) / Math.max(dt, 1e-3);
		pose.move = damp(pose.move, Math.min(1, speed / 0.9), speed > 0.05 ? 6 : 3, dt);
		var px0 = pathX(charS);
		var near = nearest();

		// how much each stop's copy is on show, and how much a project exhibit is
		var exK = 0, exBest = -1, exBestV = 0.5, i;
		for (i = 0; i < N; i++) {
			var dd = charS - stations[i].s;
			var pvi = smooth(-S * 0.42, -S * 0.18, dd) * (1 - smooth(S * 0.22, S * 0.42, dd));
			if (i === 0) pvi = Math.max(pvi, smooth(S * 0.3, 0, charS));
			if (i === N - 1) pvi = Math.max(pvi, smooth(END - S * 0.3, END - 0.5, charS));
			pv[i] = pvi;
			if (isProject[i]) {
				exK += smooth(S * 0.8, S * 0.3, Math.abs(dd));
				if (pvi > exBestV) { exBestV = pvi; exBest = i; }
			}
		}
		exK = mobile ? 0 : Math.min(1, exK);
		// the camera follows him into the light, then swings round once he is through the
		// doorway, wide of the stone, to meet him on the far side
		var heroK = 1 - smooth(10.5, 12.2, charS);
		var idle = pose.move < 0.1 ? 1 : 0;
		pose.look = damp(pose.look || 0, idle * exK, 2.5, dt);

		// walk cycle driven by distance so his feet stay planted, up to a brisk pace
		pose.walkT += Math.min(Math.abs(ds), 4.2 * dt) / STRIDE * walkDur;
		if (pose.move < 0.05) {
			// settle into the nearest planted stance
			var half = walkDur / 2, tgt = Math.round(pose.walkT / half) * half;
			pose.walkT = damp(pose.walkT, tgt, 4, dt);
		}
		if (mixer) {
			walkA.time = pose.walkT % walkDur;
			var w = smooth(0.0, 0.6, pose.move);
			walkA.setEffectiveWeight(w);
			idleA.setEffectiveWeight(1 - w);
			mixer.update(dt);
			// at an exhibit he glances across at the footage
			if (!headBone) headBone = bones['mixamorigHead'] || bones['mixamorig:Head'] || null;
			if (headBone && pose.look > 0.001) headBone.rotateY(-0.32 * pose.look);
		}
		// footsteps on the LED floor, on each heel strike
		var halfIdx = Math.floor(pose.walkT / (walkDur / 2));
		if (halfIdx !== pose.lastHalf && pose.move > 0.2) {
			pose.lastHalf = halfIdx;
			var sgn = halfIdx % 2 ? 1 : -1;
			addRipple(px0 + sgn * 0.12, charS + 0.25, 0.9 * (near && near.stepBoost ? near.stepBoost * Math.max(0.6, near.life) : 1));
			if (near && near.onStep) near.onStep();
		}

		// mood: blend the colours of the stops around him
		bgCol.setRGB(0, 0, 0); led.setRGB(0, 0, 0);
		var wsum = 0;
		stations.forEach(function (st) {
			st.life = damp(st.life, lifeTarget(st, charS), 4, dt);
			var d = Math.abs(st.s - charS);
			var w = Math.max(0, 1 - d / S);
			if (w > 0) {
				var mm = st.mood;
				tmpColor.copy(mm.bg).multiplyScalar(w); bgCol.add(tmpColor);
				tmpColor.copy(mm.led).multiplyScalar(w); led.add(tmpColor);
				wsum += w;
			}
		});
		if (wsum > 0) { bgCol.multiplyScalar(1 / wsum); led.multiplyScalar(1 / wsum); }
		if (composer) bg.copy(bgCol); else bg.copy(bgCol).convertLinearToSRGB();
		scene.fog.color.copy(bgCol);
		floorU.uBg.value.copy(bgCol);
		floorU.uLed.value.copy(led);
		skyU.uBg.value.copy(bgCol);
		skyU.uLed.value.copy(led); skyU.uTime.value = t; skyU.uWalk.value = charS;
		stationLight.color.copy(led);
		stationLight.intensity = near ? 1.8 * near.life : 0;
		stationLight.position.set(px0 + 1.8, 3.4, charS - 3.5);
		hemi.color.copy(led).lerp(white, 0.6);

		// floor patterns: each theme fades in around its stop; neighbours that
		// share a theme hand it along so it slides with him instead of jumping
		for (var k = 0; k < 8; k++) { fLife[k] = 0; fW[k] = 0; fX[k] = 0; fZ[k] = 0; }
		stations.forEach(function (st) {
			if (!st.floorKey || st.life < 0.001) return;
			var k = FLOOR_KEYS.indexOf(st.floorKey);
			fLife[k] = Math.max(fLife[k], st.life);
			fW[k] += st.life;
			fX[k] += st.life * (st.group.position.x + st.floorAt[0]);
			fZ[k] += st.life * (st.group.position.z + st.floorAt[1]);
		});
		for (k = 0; k < 8; k++) if (fW[k] > 0) floorU.uAt.value[k].set(fX[k] / fW[k], fZ[k] / fW[k]);
		floorU.uLife.value.set(fLife[0], fLife[1], fLife[2], fLife[3]);
		floorU.uLife2.value.set(fLife[4], fLife[5], fLife[6], fLife[7]);
		floorU.uTime.value = t;
		floorU.uChar.value.set(px0, charS + 0.1);

		// pointer on the floor
		var md = mouseMoved; mouseMoved = 0;
		if (mouseSeen) {
			ray.setFromCamera(mouse, camera);
			if (ray.ray.intersectPlane(floorPlane, mouseFloor)) floorU.uMouse.value.set(mouseFloor.x, mouseFloor.z);
			mouseOn = damp(mouseOn, md > 0.0005 ? 1 : 0.35, md > 0.0005 ? 10 : 1.2, dt);
			floorU.uMouseOn.value = mouseOn * (coarse ? 0.5 : 1);
			if (near && near.onMouseMove && md > 0) near.onMouseMove(md);
			if (++hoverCheck % 6 === 0) updateHover();
		}

		// stops
		pose.glasses = 0;
		stations.forEach(function (st) {
			var vis = st.portal ? charS < st.s + S * 1.6 : Math.abs(st.s - charS) < S * 1.3 || (st.s < charS && charS - st.s < S * 1.6);
			// a stop that hasn't started rising yet draws nothing
			st.group.visible = vis && (!st.rise || st.life > 0.003);
			if (!vis) { if (st.hide) st.hide(); return; }
			if (st.lazy && st.life > 0.005) { st.lazy(); st.lazy = null; }
			if (st.rise && st.life > 0.08 && !st.waved) { st.waved = true; floorU.uWave.value.set(person.position.x, person.position.z, t, 1); }
			else if (st.life < 0.02) st.waved = false;
			if (st.screen) {
				var sc = st.screen, b = sc.userData.base, bm = sc.userData.baseM;
				// on a desktop the footage plays large in the page, so the monitor stands down
				var monitorOff = bm && !mobile;
				if (b && !monitorOff) {
					var rise = easeOut(smooth(0, 0.55, st.life));
					if (bm && mobile) {
						sc.position.set(bm.x, bm.y - (1 - rise) * (sc.userData.h * sc.userData.mScale + 1.6), bm.z);
						sc.scale.setScalar(sc.userData.mScale); sc.rotation.y = 0;
					} else if (bm) {
						sc.position.set(b.x, b.y - (1 - rise) * (sc.userData.h + 1.6), b.z);
						sc.scale.setScalar(1); sc.rotation.y = sc.userData.rotD;
					} else sc.position.set(b.x - (mobile ? b.x - 0.2 : 0), b.y + (mobile ? 1.5 : 0) - (1 - rise) * (sc.userData.h + 1.6), b.z);
					sc.visible = st.life > 0.01;
				}
				if (monitorOff) sc.visible = false;
				if (sc.userData.update) sc.userData.update(monitorOff ? 0 : st.life, led);
			}
			st.update(t, st.life, dt);
		});

		// Burhan: face along the path, turning round when walking back up it
		person.position.set(px0, 0, charS);
		var heading = Math.atan2(pathX(charS + 0.5) - pathX(charS - 0.5), 1);
		var back = ds < -0.0008, fwd = ds > 0.0008;
		if (back) pose.facing = Math.PI; else if (fwd) pose.facing = 0;
		var want = (pose.facing || 0) + (pose.facing ? -heading : heading);
		if (idle) {
			want = 0.18 * Math.sin(t * 0.3) + (camera.position.x - px0) * 0.05;
			// at the start he faces the portal; at a project he half turns toward its footage
			if (heroK > 0) want = want * (1 - heroK) + heroK * Math.atan2(heroPortal.x - px0, heroPortal.z - charS);
			want -= 0.42 * exK;
		}
		var dy = ((want - pose.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
		pose.yaw += dy * (1 - Math.exp(-5 * dt));
		person.rotation.y = pose.yaw;
		shadow.position.set(px0, 0.006, charS + 0.05);
		rimLight.color.copy(led);
		rimLight.intensity = 2.2 + 3.0 * (near ? near.life : 0);
		rimLight.position.set(px0 + 0.6, 3.2, charS - 2.6);
		rimLight.target.position.set(px0, 1.2, charS);
		faceLight.position.set(px0 - 0.4, 2.0, charS + 1.6);
		avKey.position.set(px0 + 2.4, 3.6, charS + 5.0);
		avKey.target.position.set(px0, 1.05, charS);
		glasses.visible = pose.glasses > 0.02;
		if (glasses.visible) glasses.scale.setScalar(glasses.userData.s || (glasses.userData.s = glasses.scale.x)).multiplyScalar(Math.max(0.001, easeOut(pose.glasses)));
		if (mirrorWanted && avatar) {
			mirrorWanted = false;
			mirrorCam.position.set(px0 + Math.sin(pose.yaw) * 2.6, 1.45, charS + Math.cos(pose.yaw) * 2.6);
			mirrorCam.lookAt(px0, 1.35, charS);
			var oldBg = scene.background, oldFog = scene.fog;
			scene.background = null; scene.fog = null;
			renderer.setRenderTarget(mirrorRT); renderer.setClearColor(0x000000, 0); renderer.clear();
			renderer.render(scene, mirrorCam);
			renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1);
			scene.background = oldBg; scene.fog = oldFog;
		}

		// camera: in front of him looking back along the path, him to the right of
		// the copy. At the start it stands behind him instead, looking past him at
		// the portal, and swings round as he walks up to it.
		var shift = exK * exShift;
		stations.forEach(function (st) { if (CAM_SHIFT[st.kind]) shift += CAM_SHIFT[st.kind] * st.life; });
		var fx = mobile ? 0.15 : -0.95 + shift, fy = mobile ? 2.25 : 1.8, fz = mobile ? 8.4 : 7.4, fly = mobile ? 2.0 : 1.55;
		rigF.az = Math.atan2(fx, fz); rigF.r = Math.hypot(fx, fz); rigF.y = fy;
		rigF.L = fz + 4; rigF.pitch = (fly - fy) / rigF.L; rigF.rel = Math.PI - rigF.az;
		var target = rigF;
		if (heroK > 0.001) {
			// behind him along the line from the portal back to where he starts
			rigH.az = Math.atan2(pathX(0) - heroPortal.x, -heroPortal.z) + (mobile ? 0.04 : 0.1);
			if (rigH.az > rigF.az) rigH.az -= Math.PI * 2;
			rigH.r = mobile ? 8.6 : 8.5; rigH.y = mobile ? 2.0 : 1.75;
			// look at the portal, turned a little so it sits right of centre, clear of the headline
			var hcx = px0 + Math.sin(rigH.az) * rigH.r, hcz = charS + Math.cos(rigH.az) * rigH.r;
			var rel = Math.atan2(heroPortal.x - hcx, heroPortal.z - hcz) + (mobile ? 0 : heroTurn) - rigH.az;
			while (rel > rigF.rel + Math.PI) rel -= Math.PI * 2;
			while (rel < rigF.rel - Math.PI) rel += Math.PI * 2;
			rigH.rel = rel; rigH.L = 12; rigH.pitch = mobile ? 0.02 : -0.02;
			target = rigTo(rigX, heroK, rigF, rigH);
			// through the swing it keeps the portal in shot, so the frame never empties
			var tcx = px0 + Math.sin(rigX.az) * rigX.r, tcz = charS + Math.cos(rigX.az) * rigX.r;
			var relP = Math.atan2(heroPortal.x - tcx, heroPortal.z - tcz) + (mobile ? 0 : heroTurn) - rigX.az;
			while (relP > rigF.rel + Math.PI) relP -= Math.PI * 2;
			while (relP < rigF.rel - Math.PI) relP += Math.PI * 2;
			rigX.rel = rigF.rel + (relP - rigF.rel) * Math.min(1, heroK * 1.6);
		}
		// smooth the framing, not the travel: the camera rides with him exactly, so a fast
		// scroll can never let him run up into the lens or out of shot
		var kk = 1 - Math.exp(-6 * dt);
		if (!rig) rig = rigTo({}, 1, target, target);
		rigTo(rig, kk, rig, target);
		if (!coarse) mouseSm.lerp(mouse, kk);
		var yawC = rig.az + rig.rel;
		camRel.set(Math.sin(rig.az) * rig.r, rig.y, Math.cos(rig.az) * rig.r);
		camRel.x -= Math.cos(yawC) * mouseSm.x * 0.3; camRel.z += Math.sin(yawC) * mouseSm.x * 0.3; camRel.y += mouseSm.y * 0.15;
		camera.position.set(px0 + camRel.x, camRel.y, charS + camRel.z);
		_look.set(camera.position.x + Math.sin(yawC) * rig.L, camRel.y + rig.pitch * rig.L, camera.position.z + Math.cos(yawC) * rig.L);
		camera.lookAt(_look);
		// the far glow hangs behind whatever the camera is looking at
		sky.position.set(camera.position.x + Math.sin(yawC) * 69, 30, camera.position.z + Math.cos(yawC) * 69);
		sky.rotation.y = yawC + Math.PI;

		// panels, the exhibit on show, the timeline
		for (i = 0; i < N; i++) {
			var p = panels[i], v = Math.round(pv[i] * 100) / 100;
			if (p._v !== v) { p._v = v; p.style.setProperty('--vis', v); p.classList.toggle('is-off', v < 0.02); }
		}
		setExhibit(mobile ? -1 : exBest);
		var ex = Math.round(exK * 100) / 100;
		if (ex !== lastEx) { lastEx = ex; vignette.style.setProperty('--ex', ex); }
		hudFill.style.width = (charS / END * 100).toFixed(2) + '%';
		ticks.forEach(function (tk) { var past = charS >= tk.s - 0.5; if (tk.past !== past) { tk.past = past; tk.el.classList.toggle('is-past', past); } });
		var ch = near ? (stops[near.i].getAttribute('data-chapter') || '') : '';
		if (ch !== lastChapter) {
			lastChapter = ch;
			majors.forEach(function (tk) { var here = tk.chapter === ch; if (tk.here !== here) { tk.here = here; tk.el.classList.toggle('is-here', here); } });
			spaceTicks();
		}
		var pct = Math.round(charS / END * 100);
		if (pct !== lastPct) { lastPct = Math.max(0, pct); track.setAttribute('aria-valuenow', lastPct); }
		if (near && near.i !== lastNear) {
			lastNear = near.i;
			track.setAttribute('aria-valuetext', tipLabels[near.i].year + ', ' + tipLabels[near.i].name);
			hudName.textContent = tipLabels[near.i].name;
			var nk = near.kind, nav = nk === 'about' ? '#about' : nk === 'contact' ? '#contact' : nk === 'intro' ? null : '#journey';
			if (nav !== lastNav) {
				if (lastNav && navLinks[lastNav]) navLinks[lastNav].classList.remove('is-on');
				lastNav = nav;
				if (nav && navLinks[nav]) navLinks[nav].classList.add('is-on');
			}
		}
		if (!moved && (charS > 1.2 || auto.on)) { moved = true; root.classList.add('is-moved'); }

		if (composer) composer.render(dt); else renderer.render(scene, camera);
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
})();
