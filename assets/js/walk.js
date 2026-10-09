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

	/* ---------- Video player (both modes) ---------- */

	var player = document.querySelector('.player');
	var playerVideo = player.querySelector('video');
	var playerHooks = {};
	function openPlayer(stop) {
		if (playerHooks.open) playerHooks.open();
		var full = stop.getAttribute('data-full');
		var clip = stop.getAttribute('data-video');
		playerVideo.onerror = function () {
			if (clip && playerVideo.getAttribute('src') !== clip) { playerVideo.src = clip; playerVideo.play().catch(function () {}); }
		};
		playerVideo.muted = false;
		playerVideo.src = full || clip;
		if (player.showModal) player.showModal(); else player.setAttribute('open', '');
		playerVideo.play().catch(function () {});
	}
	function closePlayer() {
		playerVideo.pause();
		playerVideo.removeAttribute('src');
		playerVideo.load();
		if (player.close) player.close(); else player.removeAttribute('open');
	}
	player.querySelector('.player-close').addEventListener('click', closePlayer);
	player.addEventListener('click', function (e) { if (e.target === player) closePlayer(); });
	player.addEventListener('close', function () { playerVideo.pause(); if (playerHooks.close) playerHooks.close(); });
	stops.forEach(function (s) {
		var b = s.querySelector('.watch');
		if (b) b.addEventListener('click', function () { openPlayer(s); });
	});

	if (!root.classList.contains('is-3d') || !window.THREE) { lite(); return; }

	/* ---------- Lite mode: inline clips ---------- */

	function lite() {
		root.classList.remove('is-3d');
		root.classList.add('is-lite');
		var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
			es.forEach(function (e) {
				var v = e.target;
				if (e.isIntersecting) { if (!v.src) v.src = v.getAttribute('data-src'); v.play().catch(function () {}); }
				else v.pause();
			});
		}, { threshold: 0.4 }) : null;
		stops.forEach(function (s) {
			var clip = s.getAttribute('data-video');
			if (!clip) return;
			var fig = document.createElement('figure');
			fig.className = 'lite-media';
			fig.style.margin = '0';
			var v = document.createElement('video');
			v.muted = true; v.loop = true; v.playsInline = true;
			v.setAttribute('playsinline', '');
			v.preload = 'none';
			v.poster = s.getAttribute('data-poster');
			v.setAttribute('data-src', clip);
			v.addEventListener('click', function () { openPlayer(s); });
			fig.appendChild(v);
			s.insertBefore(fig, s.firstChild);
			if (io) io.observe(v); else v.src = clip;
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
	var bg = new THREE.Color(0x0b0b10);
	scene.background = bg;
	scene.fog = new THREE.Fog(0x0b0b10, 12, 36);
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
	// The last pass grades the frame like a film camera would: gamma, a soft
	// vignette that holds the eye on him, and a fine moving grain.
	var FINISH = {
		uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
		vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: [
			'uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;',
			'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
			'void main(){',
			'  vec4 c = LinearTosRGB(texture2D(tDiffuse, vUv));',
			'  vec2 q = (vUv - vec2(0.56, 0.5)) * vec2(1.0, 1.25);',
			'  c.rgb *= mix(0.62, 1.0, smoothstep(0.82, 0.22, length(q)));',
			// a gentle S-curve: deeper blacks, the highlights left alone
			'  c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.35);',
			'  c.rgb += (hash(vUv * vec2(1931.0, 1171.0) + fract(uTime * 7.0) * 37.0) - 0.5) * 0.028;',
			'  gl_FragColor = c;',
			'}'
		].join('\n')
	};
	var composer = null, bloom = null, finish = null;
	if (fancy) {
		try {
			composer = new THREE.EffectComposer(renderer);
			composer.addPass(new THREE.RenderPass(scene, camera));
			bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.78);
			composer.addPass(bloom);
			finish = new THREE.ShaderPass(FINISH);
			composer.addPass(finish);
		} catch (e) { composer = null; }
	}

	// A dim studio around everything, so metal, glass and paint pick up soft
	// reflections of long light panels instead of reading flat.
	(function studio() {
		try {
			var env = new THREE.Scene(), box = new THREE.BoxBufferGeometry(1, 1, 1);
			var room = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x08080b, side: THREE.BackSide }));
			room.scale.set(30, 14, 30); room.position.y = 5; env.add(room);
			[[0, 11.5, 0, 9, 0.2, 3, 0xffffff, 3.2], [-13, 4, -2, 0.2, 3, 12, 0xbfd4ff, 1.6], [13, 4, 2, 0.2, 3, 12, 0xffe2c4, 1.6],
				[0, 4, -14, 14, 2, 0.2, 0xffffff, 0.9], [0, 2.5, 14, 10, 1.2, 0.2, 0xffffff, 0.5]].forEach(function (p) {
				var m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(p[6]).multiplyScalar(p[7]) }));
				m.position.set(p[0], p[1], p[2]); m.scale.set(p[3], p[4], p[5]); env.add(m);
			});
			var pm = new THREE.PMREMGenerator(renderer);
			scene.environment = pm.fromScene(env, 0.035).texture;
			pm.dispose();
		} catch (e) {}
	})();

	function C(hex) { return new THREE.Color(hex); }
	// Background colours are picked as they should look on screen. The renderer
	// works in linear light, so take them most of the way there: all the way
	// reads as black, none of the way washes the room out to grey.
	function deep(hex) { return C(hex).lerp(C(hex).convertSRGBToLinear(), 0.68); }

	// Per-stop mood: background/fog colour and the LED floor colour.
	var MOOD = {
		intro:   { bg: deep(0x0c0c11), led: C(0xd9dbe6) },
		gate:    { bg: deep(0x0d0c10), led: C(0xfff1de) },
		court:   { bg: deep(0x1b0a33), led: C(0xff3fb4) },
		water:   { bg: deep(0x06131c), led: C(0x9fe6ff) },
		forest:  { bg: deep(0x07190f), led: C(0x58f08a) },
		tryon:   { bg: deep(0x061719), led: C(0x3fe0e0) },
		bowling: { bg: deep(0x050e28), led: C(0x4a86ff) },
		tennis:  { bg: deep(0x06180f), led: C(0xd8ff4a) },
		shadow:  { bg: deep(0x0e0d0c), led: C(0xf1e6d2) },
		fireworks: { bg: deep(0x0a0618), led: C(0xff6ad5) },
		city:    { bg: deep(0x041416), led: C(0x3ff0c8) },
		mr:      { bg: deep(0x140d08), led: C(0xffb35c) },
		galaxy:  { bg: deep(0x03060f), led: C(0x56b8ff) },
		anatomy: { bg: deep(0x150c10), led: C(0xff7a85) },
		road:    { bg: deep(0x0d2034), led: C(0xffa23a) },
		drift:   { bg: deep(0x140b22), led: C(0xb27bff) },
		shooter: { bg: deep(0x1c0b05), led: C(0xff5a1a) },
		about:   { bg: deep(0x131010), led: C(0xffdcb4) },
		contact: { bg: deep(0x0b0b10), led: C(0xe8e8ff) }
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
			// the glow starts just above the horizon, so the floor fades into the sky without a seam
			'  float rise = smoothstep(1.2, 7.5, y);',
			'  float band = rise * exp(-max(y - 7.5, 0.0) * 0.07);',
			'  float halo = rise * exp(-(x * x * 0.00035 + (y - 9.5) * (y - 9.5) * 0.0045));',
			// faint searchlights far off over the venue, swinging slowly as he walks
			'  float beams = 0.0;',
			'  for (int i = 0; i < 5; i++) {',
			'    float fi = float(i), ox = -64.0 + fi * 32.0 + sin(fi * 2.3) * 6.0;',
			'    float a = sin(uTime * 0.09 + uWalk * 0.04 + fi * 1.9) * 0.42;',
			'    vec2 q = vec2(x - ox, y + 2.0);',
			'    float d = abs(q.x * cos(a) - q.y * sin(a)), w = 0.5 + 0.07 * q.y;',
			'    beams += exp(-d * d / (w * w)) * exp(-q.y * 0.045) * step(0.0, q.x * sin(a) + q.y * cos(a));',
			'  }',
			'  vec3 c = uBg * mix(1.0, 0.55, smoothstep(6.0, 46.0, y));',
			'  gl_FragColor = vec4(c + uLed * (band * 0.05 + halo * 0.12 + beams * 0.035), 1.0);',
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
	var avatar = null, mixer = null, walkA = null, talkA = null, calmA = null, nodA = null, walkDur = 1, STRIDE = 1.83 * (HEIGHT / 1.68);
	var bones = {}, glasses = new THREE.Group();
	var pose = { move: 0, glasses: 0, yaw: 0, walkT: 0, lastHalf: 0, turn: 0 };
	// what he does while standing: a calm breathing idle, a nod when he arrives,
	// now and then a few words with his hands, and his eyes on you or the project
	var act = { still: 0, nod: 0, nodOn: false, talk: 0, talkOn: false, talkEnd: 0, nextTalk: 3.5, at: null,
		lookQ: new THREE.Quaternion(), lookW: 0, focus: 0, focusEnd: 0, glance: new THREE.Vector3() };

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

	// Three sunglasses for the try-on stop, in metres around the lens centres:
	// gold aviators, black classics and round tortoiseshell frames.
	var GLASSES = [
		{ name: 'Aviator', shape: 'drop', w: 0.056, h: 0.046, rim: 0.0022, depth: 0.0022, frame: 0xd4ae6a, metal: true, lens: 0x1d2a24, tint: 0.9, bridge: 'double' },
		{ name: 'Classic', shape: 'square', w: 0.053, h: 0.040, rim: 0.0066, depth: 0.0062, frame: 0x0c0c0e, metal: false, lens: 0x101215, tint: 0.93, bridge: 'solid' },
		{ name: 'Round', shape: 'round', w: 0.047, h: 0.045, rim: 0.0032, depth: 0.0034, frame: 0x6e3f1d, metal: false, lens: 0x7a4a1a, tint: 0.62, bridge: 'arch' }
	];
	var glassPick = { sel: 0, prev: -1, k: 1 };
	// one lens outline, centred on the lens, its outer edge towards +x
	function lensPath(g, grow) {
		var sh = new THREE.Shape(), n = 48, w = g.w / 2 + grow, h = g.h / 2 + grow;
		for (var i = 0; i < n; i++) {
			var a = i / n * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), x, y;
			if (g.shape === 'square') {
				var px = Math.sign(c) * Math.pow(Math.abs(c), 0.42), py = Math.sign(sn) * Math.pow(Math.abs(sn), 0.42);
				x = px * w * (1 + 0.05 * py); y = py * h;
			} else if (g.shape === 'drop') {
				x = c * w; y = sn * h;
				if (sn < 0) { y *= 1 + 0.26 * Math.max(0, c); x -= 0.1 * w * sn * Math.max(0, c); } else y *= 0.9;
			} else { x = c * w; y = sn * h; }
			if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
		}
		sh.closePath();
		return sh;
	}
	function makeGlasses(g) {
		var grp = new THREE.Group(), dx = 0.034;
		var fm = g.metal ? std(g.frame, { metalness: 1, roughness: 0.2, envMapIntensity: 1.3 }) : std(g.frame, { metalness: 0.05, roughness: 0.16, envMapIntensity: 0.9 });
		var lm = new THREE.MeshStandardMaterial({ color: g.lens, metalness: 0.75, roughness: 0.05, transparent: true, opacity: g.tint, envMapIntensity: 1.6 });
		[-1, 1].forEach(function (sd) {
			var side = new THREE.Group(); side.position.x = sd * dx; side.scale.x = sd; grp.add(side);
			var ring = lensPath(g, g.rim); ring.holes.push(lensPath(g, 0));
			var rg = new THREE.ExtrudeBufferGeometry(ring, { depth: g.depth, bevelEnabled: true, bevelThickness: g.depth * 0.3, bevelSize: Math.min(g.rim * 0.3, 0.0011), bevelSegments: 2, curveSegments: 4 });
			rg.translate(0, 0, -g.depth / 2);
			side.add(new THREE.Mesh(rg, fm));
			var lens = new THREE.Mesh(new THREE.ShapeBufferGeometry(lensPath(g, g.rim * 0.4)), lm);
			lens.position.z = -0.0006; side.add(lens);
			// the arm, from the hinge back over the ear, flaring out round his head
			var x0 = g.w / 2 + g.rim * 0.5, len = 0.15, flare = 0.024, L = Math.sqrt(len * len + flare * flare);
			var arm = new THREE.Mesh(rbox(g.metal ? 0.0024 : 0.0048, g.metal ? 0.0024 : 0.0075, L, g.metal ? 0.0011 : 0.002), fm);
			arm.position.set(x0 + flare / 2, g.h * 0.22, -len / 2 - g.depth / 2); arm.rotation.y = -Math.asin(flare / L);
			side.add(arm);
			if (!g.metal) { var hinge = new THREE.Mesh(rbox(0.006, 0.01, 0.008, 0.002), fm); hinge.position.set(x0 + 0.001, g.h * 0.22, -0.003); side.add(hinge); }
		});
		var gap = 2 * dx - g.w;
		if (g.bridge === 'double') {
			[[g.h * 0.36, 0.0018], [g.h * 0.12, 0.0016]].forEach(function (b) {
				var bar = new THREE.Mesh(new THREE.CylinderBufferGeometry(b[1], b[1], gap + 0.004, 8), fm);
				bar.rotation.z = Math.PI / 2; bar.position.y = b[0]; grp.add(bar);
			});
		} else if (g.bridge === 'solid') {
			var br = new THREE.Mesh(rbox(gap + 0.01, 0.008, g.depth, 0.0025), fm); br.position.y = g.h * 0.16; grp.add(br);
		} else {
			var arc = new THREE.Mesh(new THREE.TorusBufferGeometry(gap / 2 + 0.002, g.rim * 0.45, 6, 16, Math.PI), fm);
			arc.position.y = g.h * 0.02; grp.add(arc);
		}
		return grp;
	}

	(function loadAvatar() {
		if (!THREE.GLTFLoader) return;
		var L = new THREE.GLTFLoader(), got = {};
		function done() {
			if (!got.body || !got.walk || !got.idle || !got.moves) return;
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
			var talkClip = got.idle.animations[0];
			mixer = new THREE.AnimationMixer(avatar);
			walkA = mixer.clipAction(clip); walkA.play(); walkA.timeScale = 0;
			talkA = mixer.clipAction(talkClip); talkA.play();
			walkDur = clip.duration;
			// a calm standing idle and a nod, retargeted to his rig (media/avatar/moves.json)
			(got.moves.clips || []).forEach(function (c) {
				var clip = THREE.AnimationClip.parse(c);
				clip.uuid = THREE.MathUtils.generateUUID(); // parse() copies a missing uuid, and the mixer keys actions by it
				var a = mixer.clipAction(clip);
				if (c.name === 'calm') { calmA = a; a.play(); }
				if (c.name === 'nod') { nodA = a; a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
			});
			if (!calmA) { calmA = talkA; talkA = null; }
			// sunglasses for the try-on stop: three frames that swap on his face. The
			// frame sits where his eyes are on this mesh, measured in the bind pose:
			// about 10 cm above the head joint and 15.6 cm in front of it.
			var head = bones['mixamorigHead'] || bones['mixamorig:Head'];
			if (head) {
				var hs = 1 / (avatar.scale.x * worldScaleOf(head));
				glasses.scale.setScalar(hs);
				glasses.position.set(0, 0.0951, 0.1440);
				GLASSES.forEach(function (g) { var m = makeGlasses(g); m.visible = false; glasses.add(m); });
				glasses.traverse(function (o) { o.layers.enable(1); });
				glasses.visible = false;
				head.add(glasses);
			}
		}
		function worldScaleOf(o) { var v = new THREE.Vector3(); o.updateMatrixWorld(true); o.getWorldScale(v); return v.x / (HEIGHT / 1.68); }
		function fail(e) { console.error('Avatar failed to load', e); }
		L.load('media/avatar/burhan-avatar.glb', function (g) { got.body = g; done(); }, undefined, fail);
		L.load('media/avatar/walk.glb', function (g) { got.walk = g; done(); }, undefined, fail);
		L.load('media/avatar/idle.glb', function (g) { got.idle = g; done(); }, undefined, fail);
		var F = new THREE.FileLoader(); F.setResponseType('json');
		F.load('media/avatar/moves.json', function (j) { got.moves = j; done(); }, undefined, function () { got.moves = { clips: [] }; done(); });
	})();

	var _hand = new THREE.Vector3();
	function handWorld(out) {
		var b = bones['mixamorigRightHand'] || bones['mixamorig:RightHand'];
		if (b) return b.getWorldPosition(out);
		return out.set(person.position.x + 0.3, 1.0, person.position.z);
	}
	// Standing still he breathes, nods when he arrives and, now and then, says a few
	// words with his hands; the weights are blended in the frame loop.
	function updateActs(dt, near) {
		var standing = pose.move < 0.06 && pose.turn < 0.5;
		act.still = standing ? act.still + dt : 0;
		var here = near && near.life > 0.6 ? near : null;
		if (!standing) { act.at = null; act.nodOn = false; act.talkOn = false; act.nextTalk = 3 + Math.random() * 2; act.focus = 0; act.focusEnd = 0.8; }
		if (here && act.at !== here && act.still > 0.3) {
			act.at = here;
			if (nodA) { nodA.reset(); nodA.play(); act.nodOn = true; }
			// a first look at the project, then back to you
			act.focus = 1; act.focusEnd = act.still + 1.4;
		}
		if (act.nodOn && (!nodA || nodA.time > nodA.getClip().duration - 0.35)) act.nodOn = false;
		if (talkA && here && !here.quiet && !act.talkOn && !act.nodOn && act.still > act.nextTalk) {
			talkA.time = 0; act.talkOn = true; act.talkEnd = act.still + talkA.getClip().duration - 0.3;
		}
		if (act.talkOn && act.still > act.talkEnd) { act.talkOn = false; act.nextTalk = act.still + 4 + Math.random() * 5; }
		act.nod = damp(act.nod, act.nodOn ? 1 : 0, act.nodOn ? 6 : 3, dt);
		act.talk = damp(act.talk, act.talkOn ? 0.9 : 0, 2.6, dt);
	}

	// Head and neck turn to what he is looking at, on top of whatever the clips are
	// doing: mostly you, a glance at the project, sometimes a look away.
	var _lk = new THREE.Vector3(), _hp = new THREE.Vector3(), _lq = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _iq = new THREE.Quaternion(), _pi = new THREE.Quaternion();
	var _z = new THREE.Vector3(0, 0, 1), _ld = new THREE.Vector3();
	var LOOK = [['mixamorigSpine2', 0.18], ['mixamorigNeck', 0.34], ['mixamorigHead', 0.48]];
	function lookAround(dt, near) {
		var head = bones.mixamorigHead;
		if (!head) return;
		if (act.still > act.focusEnd) {
			if (act.focus === 0) {
				var r = Math.random(), toProject = near && (near.lookAt || near.screen);
				act.focus = toProject && r < (near.quiet ? 0.6 : 0.4) ? 1 : 2;
				act.focusEnd = act.still + 1 + Math.random() * 1.2;
				act.glance.set((Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4), -0.12 - Math.random() * 0.18, 1);
			} else { act.focus = 0; act.focusEnd = act.still + 3 + Math.random() * 3.5; }
		}
		head.getWorldPosition(_hp);
		if (act.focus === 1 && near && near.lookAt) near.lookAt(_lk);
		else if (act.focus === 1 && near && near.screen && near.screen.visible) near.screen.getWorldPosition(_lk);
		else if (act.focus === 2) _lk.copy(act.glance).applyQuaternion(person.quaternion).add(_hp);
		else _lk.copy(camera.position);
		// into his own frame, limited to what a neck can do
		_pi.copy(person.quaternion).invert();
		_ld.copy(_lk).sub(_hp).applyQuaternion(_pi).normalize();
		var yaw = Math.atan2(_ld.x, _ld.z), pitch = Math.asin(Math.max(-1, Math.min(1, _ld.y)));
		// nobody looks straight back over their shoulder: walking away from you, he looks ahead
		if (Math.abs(yaw) > 2.6) yaw = pitch = 0;
		yaw = Math.max(-1.05, Math.min(1.05, yaw)); pitch = Math.max(-0.35, Math.min(0.3, pitch));
		_ld.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
		_lq.setFromUnitVectors(_z, _ld);
		act.lookW = damp(act.lookW, 1 - 0.75 * smooth(0.1, 0.6, pose.move), 3, dt);
		_iq.identity().slerp(_lq, act.lookW);
		act.lookQ.slerp(_iq, 1 - Math.exp(-4.2 * dt));
		// share the turn down the spine, neck and head, applied in world space
		_wq.copy(person.quaternion).multiply(act.lookQ).multiply(_pi);
		LOOK.forEach(function (l) {
			var b = bones[l[0]];
			if (!b) return;
			_iq.identity().slerp(_wq, l[1]);
			b.parent.getWorldQuaternion(_pq);
			_lq.copy(_pq).invert().multiply(_iq).multiply(_pq);
			b.quaternion.premultiply(_lq);
		});
	}

	// keep his soles on the floor whatever mix of clips is playing
	var FEET = [['mixamorigLeftFoot', 0.116], ['mixamorigRightFoot', 0.116], ['mixamorigLeftToeBase', 0.023], ['mixamorigRightToeBase', 0.023]];
	function groundFeet(dt) {
		var lo = Infinity;
		FEET.forEach(function (f) { var b = bones[f[0]]; if (b) lo = Math.min(lo, b.getWorldPosition(_lk).y - f[1]); });
		if (lo === Infinity) return;
		var want = avatar.position.y - lo;
		avatar.position.y = act.grounded ? damp(avatar.position.y, want, 14, dt) : want;
		act.grounded = true;
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
	var glowTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
	function std(color, opts) {
		var o = { color: color, roughness: 0.55, metalness: 0.1 };
		for (var k in opts) o[k] = opts[k];
		return new THREE.MeshStandardMaterial(o);
	}
	// A box with rounded corners and softly bevelled edges, w by h by d and centred,
	// so models catch a highlight along every edge instead of ending in a hard line.
	function rbox(w, h, d, r) {
		var b = Math.min(r * 0.7, d * 0.3, w * 0.2, h * 0.2);
		var iw = w - 2 * b, ih = h - 2 * b, ir = Math.max(0.0005, Math.min(r - b, iw / 2, ih / 2));
		var sh = new THREE.Shape();
		sh.moveTo(-iw / 2 + ir, -ih / 2);
		sh.lineTo(iw / 2 - ir, -ih / 2); sh.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + ir);
		sh.lineTo(iw / 2, ih / 2 - ir); sh.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - ir, ih / 2);
		sh.lineTo(-iw / 2 + ir, ih / 2); sh.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - ir);
		sh.lineTo(-iw / 2, -ih / 2 + ir); sh.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + ir, -ih / 2);
		var g = new THREE.ExtrudeBufferGeometry(sh, { depth: Math.max(0.0005, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 5 });
		g.translate(0, 0, -(d - 2 * b) / 2);
		return g;
	}
	// A small toy car, extruded from a smooth side profile, with tyres, rims and lamps.
	function toyCar(color) {
		var car = new THREE.Group();
		var sh = new THREE.Shape();
		sh.moveTo(-0.35, 0.07); sh.lineTo(0.34, 0.07);
		sh.quadraticCurveTo(0.39, 0.08, 0.385, 0.14); sh.quadraticCurveTo(0.38, 0.18, 0.3, 0.19);
		sh.lineTo(0.13, 0.205); sh.quadraticCurveTo(0.07, 0.29, -0.02, 0.3);
		sh.lineTo(-0.17, 0.3); sh.quadraticCurveTo(-0.25, 0.29, -0.3, 0.215);
		sh.quadraticCurveTo(-0.37, 0.21, -0.37, 0.15); sh.quadraticCurveTo(-0.37, 0.08, -0.35, 0.07);
		var body = new THREE.ExtrudeBufferGeometry(sh, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 3, curveSegments: 8 });
		body.translate(0, 0, -0.12);
		var paint = std(color, { roughness: 0.22, metalness: 0.35 });
		car.add(new THREE.Mesh(body, paint));
		// windows: a dark glass band set into the cabin
		var gs = new THREE.Shape();
		gs.moveTo(0.11, 0.2); gs.quadraticCurveTo(0.06, 0.275, -0.02, 0.283); gs.lineTo(-0.16, 0.283); gs.quadraticCurveTo(-0.23, 0.275, -0.27, 0.21); gs.closePath();
		var glass = new THREE.ExtrudeBufferGeometry(gs, { depth: 0.306, bevelEnabled: false, curveSegments: 6 });
		glass.translate(0, 0.004, -0.153);
		car.add(new THREE.Mesh(glass, std(0x0a0e16, { roughness: 0.08, metalness: 0.9 })));
		var tyre = std(0x111214, { roughness: 0.8 }), rim = std(0xc9ced6, { roughness: 0.25, metalness: 0.9 });
		var tyreG = new THREE.CylinderBufferGeometry(0.072, 0.072, 0.07, 22), rimG = new THREE.CylinderBufferGeometry(0.044, 0.044, 0.074, 16);
		var wheels = [];
		[[-0.22, 1], [0.22, 1], [-0.22, -1], [0.22, -1]].forEach(function (p) {
			var wh = new THREE.Group();
			wh.add(new THREE.Mesh(tyreG, tyre)); wh.add(new THREE.Mesh(rimG, rim));
			wh.rotation.x = Math.PI / 2; wh.position.set(p[0], 0.072, p[1] * 0.15);
			car.add(wh); wheels.push(wh);
		});
		var lampG = rbox(0.02, 0.035, 0.06, 0.01);
		[-1, 1].forEach(function (z) {
			var hl = new THREE.Mesh(lampG, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.3) })); hl.position.set(0.405, 0.145, z * 0.1); car.add(hl);
			var tl = new THREE.Mesh(lampG, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.12, 0.1) })); tl.position.set(-0.388, 0.165, z * 0.1); car.add(tl);
		});
		car.userData.wheels = wheels;
		return car;
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
			// a slim display in a dark aluminium bezel, on two brushed posts
			var frame = new THREE.Mesh(rbox(w + 0.09, h + 0.09, 0.09, 0.045), std(0x0c0d10, { roughness: 0.3, metalness: 0.85 }));
			frame.position.z = -0.05; holder.add(frame);
			var back = new THREE.Mesh(rbox(w * 0.7, h * 0.6, 0.08, 0.04), std(0x101114, { roughness: 0.45, metalness: 0.7 }));
			back.position.z = -0.12; holder.add(back);
			[-w / 2 + 0.3, w / 2 - 0.3].forEach(function (x) {
				var leg = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.028, 0.028, 6, 16), std(0x9aa0a8, { metalness: 0.9, roughness: 0.32 }));
				leg.position.set(x, -h / 2 - 3, -0.13); holder.add(leg);
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
		var B = BUILD[kind];
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
			ring.material.opacity = 0.4 * life * (0.6 + 0.4 * Math.sin(t * 2));
			ring.position.set(person.position.x, 0.01, person.position.z);
			spot.position.set(person.position.x, 0.008, person.position.z);
			spot.material.opacity = life * 0.6;
			var sc = 1 + 0.05 * Math.sin(t * 2); ring.scale.set(sc, sc, sc);
		};
	};

	// Milestone gate: an LED portal across the path with the year and the
	// place, and the year written into the floor behind it.
	BUILD.gate = function (st, grp, stop) {
		st.rise = false;
		var year = stop.getAttribute('data-gate-year'), label = stop.getAttribute('data-gate-label') || '';
		var W = 3.8, H = 3.0, T = 0.06;
		var barMat = new THREE.MeshBasicMaterial({ color: 0xfff3e0 });
		var gate = new THREE.Group();
		gate.position.z = -2.2;
		// a light strip set into a dark aluminium frame
		var housing = std(0x060607, { roughness: 0.5, metalness: 0.7, envMapIntensity: 0.45 });
		[[-W / 2, H / 2, T, H], [W / 2, H / 2, T, H], [0, H, W + T, T]].forEach(function (b) {
			var m = new THREE.Mesh(new THREE.BoxBufferGeometry(b[2], b[3], T), barMat);
			m.position.set(b[0], b[1], 0.03); gate.add(m);
			var hsg = new THREE.Mesh(rbox(b[2] + 0.1, b[3] + 0.1, 0.16, 0.035), housing);
			hsg.position.set(b[0], b[1], -0.04); gate.add(hsg);
		});
		var lbl = textTex(1024, 128);
		var g = lbl.g; g.fillStyle = '#fff3e0'; g.font = '700 64px Archivo, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
		var txt = (year + '   ' + label).toUpperCase();
		g.font = '700 ' + Math.min(64, Math.floor(64 * 980 / g.measureText(txt).width)) + 'px Archivo, Arial, sans-serif';
		g.fillText(txt, 512, 68); lbl.t.needsUpdate = true;
		var plate = new THREE.Mesh(new THREE.PlaneBufferGeometry(3.6, 0.45), new THREE.MeshBasicMaterial({ map: lbl.t, transparent: true, depthWrite: false }));
		plate.position.set(0, H + 0.34, 0); gate.add(plate);
		grp.add(gate);
		var yt = textTex(1024, 400);
		var y = yt.g; y.fillStyle = '#fff'; y.font = '800 330px Archivo, Arial, sans-serif'; y.textAlign = 'center'; y.textBaseline = 'middle';
		y.fillText(year, 512, 214); yt.t.needsUpdate = true;
		var floorYear = new THREE.Mesh(new THREE.PlaneBufferGeometry(6.4, 2.5), new THREE.MeshBasicMaterial({ map: yt.t, color: 0xfff1de, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
		floorYear.rotation.x = -Math.PI / 2;
		floorYear.position.set(0.2, 0.012, -4.9);
		grp.add(floorYear);
		st.update = function (t, life) {
			var k = smooth(0, 0.6, life);
			gate.scale.set(1, Math.max(0.001, easeOut(k)), 1);
			gate.visible = k > 0.003;
			barMat.color.setRGB(1, 0.95, 0.88).multiplyScalar(0.4 + 0.9 * k);
			plate.material.opacity = smooth(0.4, 0.9, life);
			floorYear.material.opacity = 0.55 * smooth(0.3, 1, life);
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
			g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = '600 30px Archivo, Arial, sans-serif'; g.fillText('AIR HOCKEY', 256, 30);
			g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(40, 58, 432, 2);
			g.font = '800 150px Archivo, Arial, sans-serif';
			g.fillStyle = '#7aa6ff'; g.fillText(String(pts[0]), 150, 160);
			g.fillStyle = '#ff6ccb'; g.fillText(String(pts[1]), 362, 160);
			g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(250, 132, 12, 12); g.fillRect(250, 176, 12, 12);
			score.t.needsUpdate = true;
		}
		drawScore();

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
		// a free-standing kiosk: rounded aluminium body, a lit edge, a weighted foot
		var body = new THREE.Mesh(rbox(1.07, 1.77, 0.1, 0.06), std(0x15161a, { roughness: 0.28, metalness: 0.85 }));
		body.position.y = 1.35; kiosk.add(body);
		var edge = new THREE.Mesh(rbox(1.11, 1.81, 0.04, 0.075), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.9, 0.95) }));
		edge.position.set(0, 1.35, -0.045); kiosk.add(edge);
		var stand = new THREE.Mesh(rbox(0.16, 0.5, 0.1, 0.03), std(0xa3a9b2, { metalness: 0.9, roughness: 0.3 })); stand.position.y = 0.25; kiosk.add(stand);
		var foot = new THREE.Mesh(rbox(0.62, 0.05, 0.42, 0.04), std(0x15161a, { metalness: 0.85, roughness: 0.3 })); foot.rotation.x = 0; foot.position.y = 0.025; kiosk.add(foot);
		var mirrorTex = mirrorRT.texture;
		var bgm = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.95, 1.65), new THREE.MeshBasicMaterial({ color: 0x0d3b40, fog: false }));
		bgm.position.set(0, 1.35, 0.052); kiosk.add(bgm);
		var mirror = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.95, 1.65), new THREE.MeshBasicMaterial({ map: mirrorTex, transparent: true, fog: false }));
		mirror.scale.x = -1;
		mirror.position.set(0, 1.35, 0.055); kiosk.add(mirror);
		// the kiosk's own screen: the frames to choose from and the photo button
		var ui = textTex(512, 888);
		function drawUI(sel) {
			var g = ui.g;
			g.clearRect(0, 0, 512, 888);
			g.save(); g.scale(2, 2);
			g.strokeStyle = 'rgba(63,224,224,0.9)'; g.lineWidth = 4; roundRect(g, 8, 8, 240, 428, 10); g.stroke();
			var top = g.createLinearGradient(0, 8, 0, 60); top.addColorStop(0, 'rgba(4,22,24,0.85)'); top.addColorStop(1, 'rgba(4,22,24,0)');
			g.fillStyle = top; g.fillRect(10, 10, 236, 50);
			g.font = '700 13px Archivo, Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
			g.fillStyle = '#bff7f7'; g.fillText('AR TRY-ON', 22, 30);
			g.beginPath(); g.arc(228, 30, 4, 0, Math.PI * 2); g.fillStyle = '#ff5a5a'; g.fill();
			var bot = g.createLinearGradient(0, 300, 0, 436); bot.addColorStop(0, 'rgba(4,22,24,0)'); bot.addColorStop(0.35, 'rgba(4,22,24,0.88)');
			g.fillStyle = bot; g.fillRect(10, 300, 236, 134);
			g.textAlign = 'center'; g.font = '600 13px Archivo, Arial, sans-serif';
			GLASSES.forEach(function (gl, i) {
				var x = 16 + i * 77, y = 346, on = i === sel;
				roundRect(g, x, y, 70, 30, 15);
				g.fillStyle = on ? '#3fe0e0' : 'rgba(255,255,255,0.08)'; g.fill();
				g.strokeStyle = on ? '#3fe0e0' : 'rgba(191,247,247,0.45)'; g.lineWidth = 1.5; g.stroke();
				g.fillStyle = on ? '#062022' : '#e8ffff'; g.fillText(gl.name, x + 35, y + 16);
			});
			roundRect(g, 52, 390, 152, 34, 17); g.fillStyle = '#f2fbfb'; g.fill();
			g.fillStyle = '#062022'; g.font = '700 14px Archivo, Arial, sans-serif'; g.fillText('Take a photo', 128, 408);
			g.restore();
			ui.t.needsUpdate = true;
		}
		drawUI(0);
		ui.t.anisotropy = 4;
		var uiMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.95, 1.65), new THREE.MeshBasicMaterial({ map: ui.t, transparent: true, fog: false }));
		uiMesh.position.set(0, 1.35, 0.058); kiosk.add(uiMesh);
		// he looks at himself in the kiosk now and then, and keeps the talking for other stops
		st.quiet = true;
		st.lookAt = function (v) { return mirror.getWorldPosition(v); };
		var sel = 0, held = 0;
		st.update = function (t, life, dt) {
			var on = smooth(0.25, 0.8, life);
			kiosk.position.y = -(1 - easeOut(smooth(0, 0.5, life))) * 2.4;
			kiosk.position.x = mobile ? -1.3 : -2.3; kiosk.position.z = mobile ? -4.4 : -3.4;
			kiosk.rotation.y = mobile ? 0.2 : 0.38;
			kiosk.visible = life > 0.01;
			var wear = smooth(0.55, 0.95, life);
			pose.glasses = Math.max(pose.glasses, wear);
			// once they're on, the next pair every few seconds
			if (wear > 0.99) {
				held += dt;
				if (held > 2.6) { held = 0; glassPick.prev = sel; sel = (sel + 1) % GLASSES.length; glassPick.sel = sel; glassPick.k = 0; drawUI(sel); }
			} else if (life < 0.3 && sel !== 0) { held = 0; sel = 0; glassPick.sel = 0; glassPick.prev = -1; glassPick.k = 1; drawUI(0); }
			glassPick.k = Math.min(1, glassPick.k + dt / 0.5);
			bgm.material.color.setRGB(0.02 + 0.03 * on, 0.06 + 0.17 * on, 0.07 + 0.18 * on);
			mirror.material.opacity = on;
			uiMesh.material.opacity = on;
			if (on > 0.01) mirrorWanted = true;
			// he turns a little towards the kiosk
			st.stance = (mobile ? -0.08 : -0.16) * on;
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

	// Hugo Boss at Dubai Mall: an LED wall that turns everyone walking past it
	// into a live shadow. Here a wall runs along each side of the catwalk and
	// his own shadow walks with him on both. As he moves on, the shadow he
	// leaves behind breaks into dark pixels that drift up and fade, the way
	// the shadows in the mall dissolved into particles.
	BUILD.shadow = function (st, grp) {
		st.floorKey = 'runway'; st.floorAt = [0, -1.6];
		var Z0 = -9.2, Z1 = 0.8, LEN = Z1 - Z0, Y0 = 0.16, H = 2.6, SEG = 48;
		var s0 = st.s, x0 = pathX(s0);
		// the clip closes the far end of the corridor, like the screen in the mall
		if (st.screen) {
			var sd = st.screen.userData;
			sd.dScale = Math.min(3.2 / sd.w, 2.0 / sd.h);
			sd.base = new THREE.Vector3(-0.4, 0.3 + sd.h * sd.dScale / 2, -9.9);
			sd.rotD = 0;
		}
		var hall = new THREE.Group();
		hall.position.set(x0, 0, s0);
		hall.visible = false;
		scene.add(hall);

		// his silhouette, filmed side-on by an orthographic camera that only sees him
		var SIL = 2.4, RES = coarse ? 112 : 176;
		var silRT = new THREE.WebGLRenderTarget(RES, RES);
		var silCam = new THREE.OrthographicCamera(-SIL / 2, SIL / 2, SIL, 0, 0.1, 24);
		silCam.layers.set(1);
		var silMat = new THREE.MeshBasicMaterial({ color: 0xffffff, skinning: true });
		// the walls keep their own picture: red holds the fading trail, green the live shadow
		var AW = coarse ? 384 : 640, AH = coarse ? 96 : 160;
		var accA = new THREE.WebGLRenderTarget(AW, AH, { depthBuffer: false }), accB = accA.clone();
		var feedU = {
			tPrev: { value: accA.texture }, tSil: { value: silRT.texture },
			uMap: { value: new THREE.Vector4(s0 + Z0, LEN, Y0, H) },
			uSil: { value: new THREE.Vector2(s0, SIL) },
			uDecay: { value: 0.96 }, uRise: { value: 0.002 }, uClear: { value: 1 }
		};
		var feed = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), new THREE.ShaderMaterial({
			uniforms: feedU, depthTest: false, depthWrite: false,
			vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
			fragmentShader: [
				'uniform sampler2D tPrev; uniform sampler2D tSil; uniform vec4 uMap; uniform vec2 uSil;',
				'uniform float uDecay; uniform float uRise; uniform float uClear; varying vec2 vUv;',
				'void main(){',
				'  float z = uMap.x + vUv.x * uMap.y, y = uMap.z + vUv.y * uMap.w;',
				'  vec2 su = vec2((z - uSil.x) / uSil.y + 0.5, y / uSil.y);',
				'  float s = 0.0;',
				'  if (su.x > 0.0 && su.x < 1.0 && su.y > 0.0 && su.y < 1.0) s = texture2D(tSil, su).r;',
				'  float p = texture2D(tPrev, vUv - vec2(0.0, uRise)).r * uClear;',
				'  gl_FragColor = vec4(max(p * uDecay - 0.006, s), s, 0.0, 1.0);',
				'}'
			].join('\n')
		}));
		feed.frustumCulled = false;
		var feedScene = new THREE.Scene(), feedCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		feedScene.add(feed);

		var wallU = {
			tAcc: { value: accB.texture }, uMap: feedU.uMap, uTime: { value: 0 }, uOn: { value: 0 }
		};
		var wallMat = new THREE.ShaderMaterial({
			uniforms: wallU, side: THREE.DoubleSide, extensions: { derivatives: true },
			vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
			fragmentShader: [
				'uniform sampler2D tAcc; uniform vec4 uMap; uniform float uTime; uniform float uOn; varying vec3 vW;',
				'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
				'void main(){',
				'  vec2 w = vec2(vW.z, vW.y);',
				// LEDs on a diamond lattice, as on the wall in the mall
				'  const float K = 15.0;',
				'  vec2 r = vec2(w.x + w.y, w.x - w.y) * K;',
				'  vec2 id = floor(r), f = fract(r) - 0.5;',
				'  float aa = fwidth(r.x) + fwidth(r.y);',
				'  float led = 1.0 - smoothstep(0.3 - aa * 0.5, 0.3 + aa * 0.5, max(abs(f.x), abs(f.y)));',
				// far down the wall the lattice is finer than a pixel: show its average instead of moire
				'  led = mix(led, 0.36, smoothstep(0.3, 0.8, aa));',
				'  vec2 rc = id + 0.5;',
				'  vec2 wc = vec2(rc.x + rc.y, rc.x - rc.y) * (0.5 / K);',
				'  vec2 uv = vec2((wc.x - uMap.x) / uMap.y, (wc.y - uMap.z) / uMap.w);',
				'  vec4 a = texture2D(tAcc, clamp(uv, 0.0, 1.0));',
				'  float shade = smoothstep(0.25, 0.6, a.g);',
				// the trail: LEDs flicker off at random in proportion to how much shadow is left there
				'  float trail = max(a.r - a.g, 0.0);',
				// (ids kept small so the hash never rounds to exactly zero, which would switch idle LEDs off)
				'  float off = trail > 0.01 ? step(hash(mod(id, 289.0) + mod(floor(uTime * 9.0), 97.0) * 1.37), trail * 0.55) : 0.0;',
				'  float on = smoothstep(0.0, 0.2, uOn * 1.3 - hash(mod(id, 289.0) * 0.71) * 0.3);',
				'  float shimmer = 0.86 + 0.14 * sin(w.x * 0.9 - uTime * 0.8 + w.y * 0.6);',
				'  float lit = led * on * shimmer * (1.0 - shade) * (1.0 - off);',
				'  vec3 base = vec3(0.004, 0.008, 0.02);',
				// the end nearest the camera dims, so the copy beside it stays easy to read
				'  float near = 1.0 - 0.6 * smoothstep(uMap.x + uMap.y - 2.4, uMap.x + uMap.y, w.x);',
				'  vec3 c = base + vec3(0.8, 0.9, 1.0) * lit * 1.15 * near + vec3(0.015, 0.04, 0.1) * on * (1.0 - shade);',
				'  gl_FragColor = vec4(c, 1.0);',
				'  #include <encodings_fragment>',
				'}'
			].join('\n')
		});
		// a ribbon that follows the curve of the path, offset to one side
		function ribbon(y0, y1, mat) {
			var pos = new Float32Array((SEG + 1) * 2 * 3), idx = [];
			for (var i = 0; i <= SEG; i++) {
				var z = Z0 + LEN * i / SEG, x = pathX(s0 + z) - x0;
				pos.set([x, y0, z, x, y1, z], i * 6);
				if (i < SEG) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
			}
			var g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
			return new THREE.Mesh(g, mat);
		}
		var trimMat = std(0x0d0e11, { roughness: 0.28, metalness: 0.85, side: THREE.DoubleSide });
		var walls = [-1, 1].map(function () {
			var w = new THREE.Group();
			var face = ribbon(Y0, Y0 + H, wallMat); face.frustumCulled = false; w.add(face);
			w.add(ribbon(0, Y0, trimMat));
			w.add(ribbon(Y0 + H, Y0 + H + 0.06, trimMat));
			hall.add(w);
			return w;
		});
		// the BOSS mark over the screen at the end
		var logo = textTex(1024, 256), g = logo.g;
		g.fillStyle = '#f4f1ea'; g.font = '800 170px Archivo, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
		g.fillText('BOSS', 512, 136); logo.t.needsUpdate = true;
		var mark = new THREE.Mesh(new THREE.PlaneBufferGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: logo.t, transparent: true, depthWrite: false, opacity: 0, fog: false }));
		mark.position.set(-0.4, 2.45, -9.9); grp.add(mark);

		var wl = 0, fresh = true;
		st.hide = function () { hall.visible = false; wl = 0; fresh = true; };
		st.update = function (t, life, dt) {
			// the walls come up as soon as he leaves the gate before, so he walks
			// the whole corridor with his shadow beside him
			var d = person.position.z - s0;
			wl = damp(wl, smooth(-11, -8.6, d) * (1 - smooth(2.5, 6, d)), 3, dt);
			var k = easeOut(smooth(0, 0.45, wl));
			hall.visible = k > 0.003;
			mark.material.opacity = smooth(0.5, 1, life);
			var off = mobile ? 1.6 : 2.0;
			walls[0].position.x = -off; walls[1].position.x = off;
			walls.forEach(function (w) { w.scale.y = Math.max(0.001, k); });
			if (!hall.visible || !avatar) return;
			wallU.uOn.value = smooth(0.25, 1, wl);
			wallU.uTime.value = t;
			// film his silhouette from the side
			silCam.position.set(person.position.x - 8, 0, person.position.z);
			silCam.lookAt(person.position.x, 0, person.position.z);
			var ob = scene.background, of = scene.fog, oe = scene.environment;
			scene.background = null; scene.fog = null; scene.overrideMaterial = silMat;
			renderer.setRenderTarget(silRT); renderer.setClearColor(0x000000, 1); renderer.clear();
			renderer.render(scene, silCam);
			scene.overrideMaterial = null; scene.background = ob; scene.fog = of; scene.environment = oe;
			// fold it into the walls' picture, which keeps the fading trail
			feedU.uSil.value.set(person.position.z, SIL);
			feedU.uDecay.value = Math.exp(-dt * 2.8);
			feedU.uRise.value = dt * 0.07;
			feedU.uClear.value = fresh ? 0 : 1; fresh = false;
			feedU.tPrev.value = accA.texture;
			renderer.setRenderTarget(accB); renderer.render(feedScene, feedCam);
			renderer.setRenderTarget(null);
			wallU.tAcc.value = accB.texture;
			var sw = accA; accA = accB; accB = sw;
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
				if (ok && !mobile && _c.x < -0.2) ok = false;
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
	// Madinat Jumeirah MR: the venue model from the app, floating over a
	// holographic plinth the way it does in the headset, slowly turning.
	BUILD.mr = function (st, grp) {
		st.floorKey = 'tiles'; st.floorAt = [0.8, -3.2];
		var ped = new THREE.Group();
		var fade = textTex(4, 128), fg = fade.g.createLinearGradient(0, 0, 0, 128);
		fg.addColorStop(0, 'rgba(255,255,255,0.9)'); fg.addColorStop(0.7, 'rgba(255,255,255,0.18)'); fg.addColorStop(1, 'rgba(255,255,255,0.05)');
		fade.g.fillStyle = fg; fade.g.fillRect(0, 0, 4, 128); fade.t.needsUpdate = true;
		var plinth = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.62, 0.66, 0.12, 64), std(0x0c0e14, { roughness: 0.22, metalness: 0.8 }));
		plinth.position.y = 0.06; ped.add(plinth);
		var ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.1, 1.6) });
		var ring = new THREE.Mesh(new THREE.TorusBufferGeometry(0.6, 0.012, 8, 96), ringM); ring.rotation.x = Math.PI / 2; ring.position.y = 0.125; ped.add(ring);
		var beam = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.52, 0.58, 0.82, 64, 1, true), new THREE.MeshBasicMaterial({ map: fade.t, color: 0x3a8cff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
		beam.position.y = 0.53; ped.add(beam);
		var scan = new THREE.Mesh(new THREE.TorusBufferGeometry(0.55, 0.006, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.2, 1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
		scan.rotation.x = Math.PI / 2; ped.add(scan);
		// the venue: a long hall under a slatted roof, wings at each end, lit windows
		var venue = new THREE.Group();
		var stone = std(0xd9bd92, { roughness: 0.55, emissive: 0x2a1d0c, emissiveIntensity: 0.35 });
		var wood = std(0x8a6a48, { roughness: 0.5, metalness: 0.15 }), pod = std(0x2a2c33, { roughness: 0.35, metalness: 0.6 });
		var win = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.0, 0.62) });
		var add = function (geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); venue.add(m); return m; };
		add(rbox(0.96, 0.05, 0.6, 0.02), pod, 0, 0.025, 0);
		add(rbox(0.7, 0.17, 0.46, 0.015), stone, 0, 0.135, 0);
		add(rbox(0.16, 0.22, 0.52, 0.015), stone, -0.4, 0.16, 0);
		add(rbox(0.16, 0.22, 0.52, 0.015), stone, 0.4, 0.16, 0);
		[-1, 1].forEach(function (z) {
			add(new THREE.BoxBufferGeometry(0.6, 0.035, 0.004), win, 0, 0.15, z * 0.232);
			add(new THREE.BoxBufferGeometry(0.11, 0.05, 0.004), win, -0.4, 0.2, z * 0.262);
			add(new THREE.BoxBufferGeometry(0.11, 0.05, 0.004), win, 0.4, 0.2, z * 0.262);
		});
		for (var i = 0; i < 15; i++) add(rbox(0.022, 0.024, 0.5, 0.006), wood, -0.315 + i * 0.045, 0.235, 0);
		[-0.24, 0.24].forEach(function (z) { add(rbox(0.68, 0.02, 0.025, 0.006), wood, 0, 0.255, z); });
		venue.position.y = 0.98; venue.scale.setScalar(1.35); ped.add(venue);
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
			var sy = (t * 0.32) % 1;
			scan.position.y = 0.14 + sy * 0.86; scan.material.opacity = Math.sin(sy * Math.PI) * 0.9;
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

	// Car Path Draw: the level from the footage. Brick platforms topped with
	// grass, spikes in the gap, a double axe swinging from the ceiling block,
	// and the line you draw, which the car then drives along to the flag.
	BUILD.road = function (st, grp) {
		st.floorKey = 'road'; st.floorAt = [1.0, -3.4];
		var g = new THREE.Group(); g.position.set(1.2, 0, -4.4); grp.add(g);
		var bricks = textTex(256, 128), bg = bricks.g;
		bg.fillStyle = '#93443c'; bg.fillRect(0, 0, 256, 128);
		for (var row = 0; row < 4; row++) for (var col = -1; col < 5; col++) {
			var bx = col * 64 + (row % 2) * 32, by = row * 32;
			bg.fillStyle = ['#a14d43', '#9a483f', '#a85448', '#954339'][(row * 5 + col + 9) % 4];
			bg.fillRect(bx + 3, by + 3, 58, 26);
		}
		bricks.t.needsUpdate = true; bricks.t.wrapS = bricks.t.wrapT = THREE.RepeatWrapping; bricks.t.repeat.set(1.6, 1.6);
		var brick = std(0xffffff, { map: bricks.t, roughness: 0.85 }), grass = std(0x4fcf4a, { roughness: 0.6, emissive: 0x0d3a0c, emissiveIntensity: 0.6 });
		function platform(x) {
			var p = new THREE.Group();
			var b = new THREE.Mesh(rbox(1.3, 0.9, 0.7, 0.05), brick); b.position.y = 0.45; p.add(b);
			var t = new THREE.Mesh(rbox(1.38, 0.1, 0.76, 0.04), grass); t.position.y = 0.92; p.add(t);
			p.position.x = x; g.add(p); return p;
		}
		platform(-2.1); platform(2.1);
		// the ceiling block the axe hangs from
		var ceil = new THREE.Mesh(rbox(0.5, 0.36, 0.5, 0.04), brick); ceil.position.set(0.15, 2.75, 0.15); g.add(ceil);
		var steel = std(0xd4d9e0, { metalness: 0.95, roughness: 0.2 }), dark = std(0x3a2a22, { roughness: 0.5, metalness: 0.3 });
		var pit = new THREE.Mesh(rbox(1.9, 0.06, 0.5, 0.02), std(0x1a1b1f, { roughness: 0.5, metalness: 0.4 })); pit.position.set(0, 0.03, 0); g.add(pit);
		var spikeG = new THREE.ConeBufferGeometry(0.06, 0.24, 12);
		for (var k = 0; k < 7; k++) for (var r = -1; r <= 1; r += 2) { var sp = new THREE.Mesh(spikeG, steel); sp.position.set(-0.81 + k * 0.27 + r * 0.04, 0.18, r * 0.1); g.add(sp); }
		var flag = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.28, 0.17, 8, 1), new THREE.MeshStandardMaterial({ color: 0x3fdc4a, emissive: 0x1a8a22, emissiveIntensity: 0.7, side: THREE.DoubleSide, roughness: 0.6 }));
		flag.position.set(2.32, 1.42, 0); g.add(flag);
		var flagP = flag.geometry.attributes.position, flagX = [];
		for (var i = 0; i < flagP.count; i++) flagX.push(flagP.getX(i));
		var pole = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.012, 0.012, 0.56, 10), std(0xf2f2f2, { roughness: 0.3, metalness: 0.5 })); pole.position.set(2.18, 1.24, 0); g.add(pole);
		var curve = new THREE.CatmullRomCurve3([
			new THREE.Vector3(-1.45, 0.97, 0), new THREE.Vector3(-0.8, 0.82, 0), new THREE.Vector3(-0.2, 0.58, 0),
			new THREE.Vector3(0.45, 0.68, 0), new THREE.Vector3(1.0, 0.9, 0), new THREE.Vector3(1.45, 0.97, 0)
		]);
		var SEG = 140, RAD = 8;
		var tube = new THREE.Mesh(new THREE.TubeBufferGeometry(curve, SEG, 0.03, RAD, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.62, 0.16) }));
		g.add(tube);
		var car = toyCar(0xe0322a); car.scale.setScalar(0.5); g.add(car);
		// the axe: two crescent blades on a hub, swinging on a pair of rods
		var blade = new THREE.Group();
		blade.position.set(0.15, 2.58, 0.15);
		[-0.06, 0.06].forEach(function (z) {
			var rod = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.014, 0.014, 1.02, 8), dark); rod.position.set(0, -0.5, z); blade.add(rod);
		});
		var hub = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.07, 0.07, 0.16, 20), dark); hub.rotation.x = Math.PI / 2; hub.position.y = -1.02; blade.add(hub);
		var cres = new THREE.Shape();
		cres.absarc(0, 0, 0.3, -1.05, 1.05, false); cres.absarc(-0.17, 0, 0.27, 0.86, -0.86, true);
		var cresG = new THREE.ExtrudeBufferGeometry(cres, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 24 });
		cresG.translate(0.02, 0, -0.006);
		[0, Math.PI].forEach(function (a) { var c = new THREE.Mesh(cresG, steel); c.rotation.z = a; c.position.y = -1.02; blade.add(c); });
		var bar = new THREE.Mesh(rbox(0.36, 0.05, 0.03, 0.012), dark); bar.position.y = -1.02; blade.add(bar);
		g.add(blade);
		var drive = 0;
		st.update = function (t, life, dt) {
			var k = smooth(0.0, 0.3, life);
			g.position.y = -(1 - easeOut(k)) * 2.6;
			g.visible = k > 0.005;
			var draw = smooth(0.35, 0.85, life);
			tube.geometry.setDrawRange(0, Math.floor(SEG * draw) * RAD * 6);
			blade.rotation.z = Math.sin(t * 2.0) * 0.75 * k;
			for (var i = 0; i < flagP.count; i++) { var fx = flagX[i] + 0.14; flagP.setZ(i, Math.sin(fx * 18 - t * 6) * 0.025 * fx * 4); }
			flagP.needsUpdate = true;
			var u;
			if (draw >= 0.999) { drive = (drive + dt / 2.6) % 1.35; u = Math.min(1, drive); }
			else { drive = 0; u = 0; }
			if (u <= 0) { car.position.set(-1.75, 0.97, 0); car.rotation.z = 0; }
			else {
				var pt = curve.getPointAt(u), tg = curve.getTangentAt(u);
				car.position.set(pt.x, pt.y + 0.02, 0); car.rotation.z = Math.atan2(tg.y, tg.x);
			}
			car.userData.wheels.forEach(function (w) { w.rotation.y -= dt * 10 * (u > 0 && u < 1 ? 1 : 0); });
		};
	};

	BUILD.drift = function (st, grp) {
		st.floorKey = 'road'; st.floorAt = [1.4, -4.2];
		var g = new THREE.Group(); g.position.set(1.2, 0, -5.4); grp.add(g);
		var car = toyCar(0x2f63ff);
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
			car.userData.wheels.forEach(function (w) { w.rotation.y -= dt * 16 * life; });
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
		var frame = new THREE.Mesh(rbox(w + 0.1, h + 0.1, 0.08, 0.04), std(0x0c0d10, { metalness: 0.85, roughness: 0.3 })); frame.position.z = -0.05; holder.add(frame);
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
		var g = tx.g; g.fillStyle = '#fff'; g.font = '800 190px Archivo, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
		g.fillText('HELLO', 512, 136); tx.t.needsUpdate = true;
		var m = new THREE.Mesh(new THREE.PlaneBufferGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: tx.t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false }));
		m.rotation.x = -Math.PI / 2; m.position.set(0.3, 0.02, 2.6);
		grp.add(m);
		st.update = function (t, life) { m.material.opacity = smooth(0.4, 1, life) * (0.75 + 0.25 * Math.sin(t * 2.4)); };
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
	document.querySelectorAll('a[href^="#"]').forEach(function (a) {
		a.addEventListener('click', function (e) {
			var id = a.getAttribute('href').slice(1);
			var el = id ? document.getElementById(id) : null;
			if (!el) return;
			var i = stops.indexOf(el);
			if (i < 0) i = stops.indexOf(el.nextElementSibling);
			if (i < 0) return;
			e.preventDefault();
			setPlaying(false);
			window.scrollTo({ top: anchors[i], behavior: 'smooth' });
		});
	});

	/* ---------- Clicks in the world ---------- */

	document.querySelector('.stops').addEventListener('click', worldClick);
	function worldClick(e) {
		if (e.target.closest && e.target.closest('a, button, .panel > *')) return;
		setPointer(e);
		ray.setFromCamera(mouse, camera);
		var hits = ray.intersectObjects(screens, false);
		if (hits.length) {
			var s = hits[0].object.userData;
			if (stations[s.index] && stations[s.index].life > 0.5) { openPlayer(s.stop); return; }
		}
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
		ray.setFromCamera(mouse, camera);
		var hits = ray.intersectObjects(screens, false);
		var over = hits.length && stations[hits[0].object.userData.index].life > 0.5;
		document.body.style.cursor = over ? 'pointer' : '';
	}

	/* ---------- Timeline ticks ---------- */

	var ticksEl = document.querySelector('.track-ticks');
	var ticks = [];
	stops.forEach(function (s, i) {
		var y = s.getAttribute('data-gate-year');
		if (!y) return;
		var el = document.createElement('i');
		el.className = 'track-tick';
		el.style.left = (stopS(i) / END * 100) + '%';
		el.innerHTML = '<span>' + y + '</span>';
		ticksEl.appendChild(el);
		ticks.push({ el: el, s: stopS(i) });
	});
	// on a narrow track, drop a year label that would collide with the one before it
	function spaceTicks() {
		var w = ticksEl.clientWidth, last = -1e9;
		ticks.forEach(function (tk) {
			var x = tk.s / END * w, hide = x - last < 34;
			tk.el.firstChild.style.visibility = hide ? 'hidden' : '';
			if (!hide) last = x;
		});
	}
	spaceTicks();
	window.addEventListener('resize', spaceTicks);

	/* ---------- Timeline: scrub it like a video, or let it play ---------- */

	var track = document.querySelector('.track');
	var tip = track.querySelector('.track-tip');
	var playBtn = document.querySelector('.hud-play');
	var tipLabels = stops.map(function (s, i) {
		var k = kinds[i], h = s.querySelector('h2');
		var name = k === 'intro' ? 'Start' : k === 'about' ? 'About' : k === 'contact' ? 'Contact' : (s.getAttribute('data-gate-label') || (h ? h.textContent : ''));
		return { year: s.getAttribute('data-year') || '', name: name.replace(/\s+/g, ' ').trim() };
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
		var cur = scrollToS(window.scrollY) / S, k = e.key, to = -1;
		if (k === 'ArrowRight' || k === 'ArrowUp' || k === 'PageDown') to = Math.min(N - 1, Math.floor(cur + 0.05) + 1);
		else if (k === 'ArrowLeft' || k === 'ArrowDown' || k === 'PageUp') to = Math.max(0, Math.ceil(cur - 0.05) - 1);
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
	var cuePlay = document.querySelector('.cue-play');
	if (cuePlay) cuePlay.addEventListener('click', function () { setPlaying(true); });
	playerHooks.open = function () { auto.resume = auto.on; setPlaying(false); };
	playerHooks.close = function () { if (auto.resume) { auto.resume = false; setPlaying(true); } };

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
	var hudFill = document.querySelector('.track-fill');
	var hudChapter = document.querySelector('.hud-chapter');
	var lastChapter = null, lastPct = -1, lastNear = -1;
	var charS = 0, lastStepSide = 0, lastT = performance.now();
	var tmpColor = new THREE.Color(), led = new THREE.Color(), bgCol = new THREE.Color(), white = new THREE.Color(1, 1, 1);
	var camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camX = 0;
	var camSm = new THREE.Vector3(), lookSm = new THREE.Vector3(), camInit = false, _look = new THREE.Vector3();
	var running = true;
	var CAM_SHIFT = { intro: -0.9, about: -1.0, contact: -0.4 };

	function lifeTarget(st, s) {
		var d = s - st.s;
		if (!st.rise) return smooth(S * 0.7, S * 0.15, Math.abs(d));
		// rise as he arrives (everything is behind him by then), fade out once he has moved on
		return smooth(-3.2, -0.4, d) * (1 - smooth(S * 0.5, S * 0.85, d));
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
		measure();
	}
	window.addEventListener('resize', resize);
	window.addEventListener('load', measure);
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
	resize();
	charS = scrollToS(window.scrollY);

	document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running) { lastT = performance.now(); requestAnimationFrame(frame); } });

	function frame(now) {
		if (!running) return;
		var dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000));
		lastT = now;
		clock += dt;
		var t = clock;

		if (auto.on && !scrubbing) stepAuto(dt);
		var targetS = auto.on && !scrubbing ? auto.s : scrollToS(window.scrollY);
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

		// walk cycle driven by distance so his feet stay planted, up to a brisk pace;
		// turning round on the spot he steps instead of spinning on his heels
		var stepTurn = smooth(0.8, 2.6, pose.turn) * 0.75;
		pose.walkT += Math.min(Math.abs(ds), 4.2 * dt) / STRIDE * walkDur + stepTurn * dt * 0.9 * walkDur;
		var stepping = Math.max(pose.move, stepTurn);
		if (stepping < 0.05) {
			// settle into the nearest planted stance
			var half = walkDur / 2, tgt = Math.round(pose.walkT / half) * half;
			pose.walkT = damp(pose.walkT, tgt, 4, dt);
		}
		if (mixer) {
			walkA.time = pose.walkT % walkDur;
			var w = smooth(0.0, 0.6, stepping);
			updateActs(dt, near);
			// standing: the calm idle, with the nod and the talking clip blended over it
			var rest = 1 - w, wn = nodA ? rest * act.nod : 0, wt = talkA ? rest * (1 - act.nod) * act.talk : 0;
			walkA.setEffectiveWeight(w);
			if (nodA) nodA.setEffectiveWeight(wn);
			if (talkA) talkA.setEffectiveWeight(wt);
			calmA.setEffectiveWeight(rest - wn - wt);
			// the mixer only writes a bone when its value changes, so put back the pose it
			// last wrote before the head turn was layered on, or the turn would pile up
			LOOK.forEach(function (l) { var b = bones[l[0]]; if (b && b.userData.base) b.quaternion.copy(b.userData.base); });
			mixer.update(dt);
			LOOK.forEach(function (l) { var b = bones[l[0]]; if (b) (b.userData.base || (b.userData.base = new THREE.Quaternion())).copy(b.quaternion); });
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
				var mm = MOOD[st.kind] || MOOD.intro;
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
			var vis = Math.abs(st.s - charS) < S * 1.3 || (st.s < charS && charS - st.s < S * 1.6);
			// a stop that hasn't started rising yet draws nothing
			st.group.visible = vis && (!st.rise || st.life > 0.003);
			if (!vis) { if (st.hide) st.hide(); return; }
			if (st.lazy && st.life > 0.005) { st.lazy(); st.lazy = null; }
			if (st.rise && st.life > 0.08 && !st.waved) { st.waved = true; floorU.uWave.value.set(person.position.x, person.position.z, t, 1); }
			else if (st.life < 0.02) st.waved = false;
			if (st.screen) {
				var sc = st.screen, b = sc.userData.base;
				if (b) {
					var rise = easeOut(smooth(0, 0.55, st.life)), bm = sc.userData.baseM;
					if (bm && mobile) {
						sc.position.set(bm.x, bm.y - (1 - rise) * (sc.userData.h * sc.userData.mScale + 1.6), bm.z);
						sc.scale.setScalar(sc.userData.mScale); sc.rotation.y = 0;
					} else if (bm) {
						var ds = sc.userData.dScale || 1;
						sc.position.set(b.x, b.y - (1 - rise) * (sc.userData.h * ds + 1.6), b.z);
						sc.scale.setScalar(ds); sc.rotation.y = sc.userData.rotD;
					} else sc.position.set(b.x - (mobile ? b.x - 0.2 : 0), b.y + (mobile ? 1.5 : 0) - (1 - rise) * (sc.userData.h + 1.6), b.z);
					sc.visible = st.life > 0.01;
				}
				if (sc.userData.update) sc.userData.update(st.life, led);
			}
			st.update(t, st.life, dt);
		});

		// Burhan: face along the path, turning round when walking back up it
		person.position.set(px0, 0, charS);
		var heading = Math.atan2(pathX(charS + 0.5) - pathX(charS - 0.5), 1);
		var back = ds < -0.0008, fwd = ds > 0.0008;
		if (back) pose.facing = Math.PI; else if (fwd) pose.facing = 0;
		var want = (pose.facing || 0) + (pose.facing ? -heading : heading);
		// standing, he squares up to you and stays put; his head does the looking
		if (pose.move < 0.1) want = (camera.position.x - px0) * 0.05 + (near && near.stance || 0);
		var dy = ((want - pose.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
		var dYaw = dy * (1 - Math.exp(-(pose.move < 0.1 ? 3.4 : 5) * dt));
		pose.yaw += dYaw;
		pose.turn = damp(pose.turn, Math.abs(dYaw) / Math.max(dt, 1e-3), 8, dt);
		person.rotation.y = pose.yaw;
		if (avatar) {
			person.updateMatrixWorld(true);
			groundFeet(dt);
			lookAround(dt, near);
		}
		shadow.position.set(px0, 0.006, charS + 0.05);
		rimLight.color.copy(led);
		rimLight.intensity = 2.2 + 3.0 * (near ? near.life : 0);
		rimLight.position.set(px0 + 0.6, 3.2, charS - 2.6);
		rimLight.target.position.set(px0, 1.2, charS);
		faceLight.position.set(px0 - 0.4, 2.0, charS + 1.6);
		avKey.position.set(px0 + 2.4, 3.6, charS + 5.0);
		avKey.target.position.set(px0, 1.05, charS);
		sky.position.set(px0, 30, charS - 62);
		// the frames he is trying on: the new pair drops onto his face as the last one lifts away
		glasses.visible = pose.glasses > 0.02;
		if (glasses.visible) glasses.children.forEach(function (g, i) {
			var on = easeOut(pose.glasses), kin = easeOut(glassPick.k), kout = smooth(0, 0.55, glassPick.k);
			var k = i === glassPick.sel ? kin * on : i === glassPick.prev ? 1 - kout : 0;
			g.visible = k > 0.002;
			g.scale.setScalar(Math.max(0.001, k));
			g.position.y = i === glassPick.sel ? (1 - kin) * 0.045 + (1 - on) * 0.05 : kout * 0.035;
		});
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

		// camera: just ahead of him, slightly to his right, looking back along the path
		var shift = 0;
		stations.forEach(function (st) { if (CAM_SHIFT[st.kind]) shift += CAM_SHIFT[st.kind] * st.life; });
		camX = px0;
		if (mobile) {
			camPos.set(camX + 0.15, 2.25, charS + 8.4);
			camLook.set(camX + 0.15, 2.0, charS - 4);
		} else {
			camPos.set(camX - 0.95 + shift, 1.8, charS + 7.4);
			camLook.set(camX - 0.95 + shift, 1.55, charS - 4);
		}
		if (!coarse) { camPos.x += mouse.x * 0.3; camPos.y += mouse.y * 0.15; }
		// smooth the framing, not the travel: the camera rides with him exactly, so a fast
		// scroll can never let him run up into the lens or out of shot
		camPos.x -= px0; camPos.z -= charS; camLook.x -= px0; camLook.z -= charS;
		camSm.lerp(camPos, 1 - Math.exp(-6 * dt)); lookSm.lerp(camLook, 1 - Math.exp(-6 * dt));
		if (!camInit) { camSm.copy(camPos); lookSm.copy(camLook); camInit = true; }
		camera.position.set(camSm.x + px0, camSm.y, camSm.z + charS);
		_look.set(lookSm.x + px0, lookSm.y, lookSm.z + charS);
		camera.lookAt(_look);

		// panels and timeline
		for (var i = 0; i < N; i++) {
			var d = charS - stations[i].s;
			var vis2 = smooth(-S * 0.42, -S * 0.18, d) * (1 - smooth(S * 0.22, S * 0.42, d));
			if (i === 0) vis2 = Math.max(vis2, smooth(S * 0.3, 0, charS));
			if (i === N - 1) vis2 = Math.max(vis2, smooth(END - S * 0.3, END - 0.5, charS));
			var p = panels[i];
			var v = Math.round(vis2 * 100) / 100;
			if (p._v !== v) { p._v = v; p.style.setProperty('--vis', v); p.classList.toggle('is-off', v < 0.02); }
		}
		hudFill.style.width = (charS / END * 100).toFixed(2) + '%';
		ticks.forEach(function (tk) { var past = charS >= tk.s - 0.5; if (tk.past !== past) { tk.past = past; tk.el.classList.toggle('is-past', past); } });
		var ch = near ? (stops[near.i].getAttribute('data-chapter') || '') : '';
		if (ch !== lastChapter) { lastChapter = ch; hudChapter.textContent = ch; }
		var pct = Math.round(charS / END * 100);
		if (pct !== lastPct) { lastPct = pct; track.setAttribute('aria-valuenow', pct); }
		if (near && near.i !== lastNear) { lastNear = near.i; track.setAttribute('aria-valuetext', tipLabels[near.i].year + ', ' + tipLabels[near.i].name); }

		if (finish) finish.uniforms.uTime.value = t;
		if (composer) composer.render(dt); else renderer.render(scene, camera);
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
})();
