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
	function openPlayer(stop) {
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
	player.addEventListener('close', function () { playerVideo.pause(); });
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
	var camera = new THREE.PerspectiveCamera(36, 1, 0.1, 140);

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
			bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 0.78);
			composer.addPass(bloom);
			composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
		} catch (e) { composer = null; }
	}

	function C(hex) { return new THREE.Color(hex); }

	// Per-stop mood: background/fog colour and the LED floor colour.
	var MOOD = {
		intro:   { bg: C(0x0c0c11), led: C(0xd9dbe6) },
		gate:    { bg: C(0x0d0c10), led: C(0xfff1de) },
		court:   { bg: C(0x1b0a33), led: C(0xff3fb4) },
		water:   { bg: C(0x06131c), led: C(0x9fe6ff) },
		forest:  { bg: C(0x07190f), led: C(0x58f08a) },
		tryon:   { bg: C(0x061719), led: C(0x3fe0e0) },
		bowling: { bg: C(0x050e28), led: C(0x4a86ff) },
		tennis:  { bg: C(0x06180f), led: C(0xd8ff4a) },
		shadow:  { bg: C(0x0e0d0c), led: C(0xf1e6d2) },
		fireworks: { bg: C(0x0a0618), led: C(0xff6ad5) },
		city:    { bg: C(0x041416), led: C(0x3ff0c8) },
		mr:      { bg: C(0x140d08), led: C(0xffb35c) },
		galaxy:  { bg: C(0x03060f), led: C(0x56b8ff) },
		anatomy: { bg: C(0x150c10), led: C(0xff7a85) },
		road:    { bg: C(0x0d2034), led: C(0xffa23a) },
		drift:   { bg: C(0x140b22), led: C(0xb27bff) },
		shooter: { bg: C(0x1c0b05), led: C(0xff5a1a) },
		about:   { bg: C(0x131010), led: C(0xffdcb4) },
		contact: { bg: C(0x0b0b10), led: C(0xe8e8ff) }
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
			'uniform float uTime; uniform vec4 uSteps[MAX_STEPS]; uniform vec2 uChar; uniform vec2 uMouse; uniform float uMouseOn;',
			'uniform vec3 uLed; uniform vec3 uBg; uniform vec4 uLife; uniform vec4 uLife2; uniform vec2 uAt[8];',
			'uniform float uFogNear; uniform float uFogFar; uniform float uReflect; uniform sampler2D tDiffuse;',
			'varying vec4 vUv; varying vec3 vW;',
			'float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }',
			'float line(float d, float w){ return 1.0 - smoothstep(w*0.5, w*0.5 + 0.03, abs(d)); }',
			'float thin(float d, float w){ return 1.0 - smoothstep(w * 0.4, w, abs(d)); }',
			'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
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
			'    e += s.w * (exp(-pow((d - r) * 5.0, 2.0)) * exp(-age * 1.0) + 0.9 * exp(-d * d * 22.0) * exp(-age * 2.2));',
			'  }',
			'  float dc = distance(cid, uChar);',
			'  e += 0.38 * exp(-dc * dc * 1.6);',
			'  float dm = distance(cid, uMouse);',
			'  e += uMouseOn * (0.85 * exp(-dm * dm * 2.6) + 0.25 * exp(-pow((dm - mod(uTime*1.2, 3.0)) * 4.0, 2.0)) * exp(-dm*0.6));',
			'  col += uLed * e;',
			'  vec3 glow = vec3(0.0), surf = vec3(0.0);',
			'  if (uLife.x > 0.001) {',
			'    vec2 q = (cid - uAt[0]).yx * vec2(1.0, -1.0);',
			'    float box = sdBox(q, vec2(4.6, 2.7));',
			'    float lines = line(box, 0.07) + line(q.x, 0.06) * step(box, 0.0) + line(length(q) - 0.9, 0.06)',
			'      + line(sdBox(q - vec2(-3.7, 0.0), vec2(0.9, 1.0)), 0.05) * step(q.x, -2.8) + line(sdBox(q - vec2(3.7, 0.0), vec2(0.9, 1.0)), 0.05) * step(2.8, q.x);',
			'    float ang = atan(q.y, q.x);',
			'    float burst = step(box, 0.0) * (0.16 + 0.16 * step(0.0, sin(ang * 10.0 + uTime * 0.6)));',
			'    vec3 pink = vec3(1.0, 0.22, 0.7), purple = vec3(0.45, 0.2, 1.0);',
			'    col += uLife.x * (mix(purple, pink, smoothstep(-4.0, 4.0, q.x)) * burst + vec3(1.0, 0.85, 1.0) * min(lines, 1.0) * 0.9);',
			'  }',
			'  if (uLife.y > 0.001) {',
			'    vec2 q = cid - uAt[1];',
			'    float fall = exp(-dot(q * vec2(0.25, 0.16), q * vec2(0.25, 0.16)));',
			'    float c = sin(cid.x * 3.1 + uTime * 0.9) + sin(cid.y * 4.3 - uTime * 1.1) + sin((cid.x + cid.y) * 2.3 + uTime * 0.6) + sin(length(q) * 3.0 - uTime * 1.4);',
			'    c = pow(0.5 + 0.125 * c, 3.0);',
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
			'    float lights = exp(-pow(fract(q.y * 0.05 + uTime * 0.16) - 0.5, 2.0) * 1400.0) * road;',
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
			'    float pulse = gz * exp(-pow((q.x - px) * 1.3, 2.0)) * step(0.5, hash(vec2(ci.y, 1.0)))',
			'                + gx * exp(-pow((q.y - pz) * 1.3, 2.0)) * step(0.5, hash(vec2(ci.x, 2.0)));',
			'    float r = length(q);',
			'    float rings = thin(r - 1.5, 0.035) + thin(r - 2.4, 0.025) * step(0.0, sin(atan(q.y, q.x) * 18.0 + uTime * 0.8));',
			'    float scan = exp(-pow(r - mod(uTime * 2.4, 10.0), 2.0) * 5.0);',
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
			'    float wave = exp(-pow(fract(q.y * 0.06 - uTime * 0.22) - 0.5, 2.0) * 120.0);',
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
	var skyU = { uBg: { value: new THREE.Color() }, uLed: { value: new THREE.Color() } };
	var sky = new THREE.Mesh(new THREE.PlaneBufferGeometry(240, 64), new THREE.ShaderMaterial({
		uniforms: skyU, depthWrite: false,
		vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: [
			'uniform vec3 uBg; uniform vec3 uLed; varying vec2 vUv;',
			'void main(){',
			'  float y = vUv.y * 64.0 - 2.0, x = (vUv.x - 0.5) * 240.0;',
			'  float band = exp(-max(y, 0.0) * 0.12);',
			'  float halo = exp(-(x * x * 0.0005 + (y - 4.0) * (y - 4.0) * 0.006));',
			'  gl_FragColor = vec4(uBg + uLed * (band * 0.08 + halo * 0.05), 1.0);',
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
		L.load('media/avatar/burhan-avatar.glb', function (g) { got.body = g; done(); });
		L.load('media/avatar/walk.glb', function (g) { got.walk = g; done(); });
		L.load('media/avatar/idle.glb', function (g) { got.idle = g; done(); });
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
		});
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
		var mat = new THREE.MeshBasicMaterial({ map: poster, color: 0x222222, fog: false, side: opts.side || THREE.FrontSide });
		var mesh, holder = new THREE.Group();
		if (opts.geometry) { mesh = new THREE.Mesh(opts.geometry, mat); holder.add(mesh); }
		else {
			mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(w, h), mat);
			holder.add(mesh);
			var gridTex = ledGrid.clone(); gridTex.needsUpdate = true; gridTex.repeat.set(w * 26, h * 26);
			var grid = new THREE.Mesh(new THREE.PlaneBufferGeometry(w, h), new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, depthWrite: false, fog: false }));
			grid.position.z = 0.004; holder.add(grid);
			var frame = new THREE.Mesh(new THREE.BoxBufferGeometry(w + 0.1, h + 0.1, 0.12), std(0x0b0b0d, { roughness: 0.35, metalness: 0.5 }));
			frame.position.z = -0.07; holder.add(frame);
			[-w / 2 + 0.25, w / 2 - 0.25].forEach(function (x) {
				var leg = new THREE.Mesh(new THREE.BoxBufferGeometry(0.08, 6, 0.08), std(0x141418, { metalness: 0.6, roughness: 0.4 }));
				leg.position.set(x, -h / 2 - 3, -0.15); holder.add(leg);
			});
			var glow = new THREE.Mesh(new THREE.PlaneBufferGeometry(w * 2.2, h * 2.6), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
			glow.position.z = -0.25; holder.add(glow);
			holder.userData.glow = glow;
		}
		holder.userData.h = h;
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
	var SCREEN_AT = {
		court: [2.4, -6.8], water: [2.0, -6.0], tryon: [0.6, -7.2], bowling: [3.2, -9.0], tennis: [3.0, -8.6],
		shadow: [2.2, -7.0], fireworks: [2.4, -7.4], city: [2.6, -8.2], mr: [2.6, -7.4],
		galaxy: [2.4, -6.8], anatomy: [2.6, -7.0], road: [2.4, -7.4], drift: [2.6, -7.6], shooter: [2.2, -7.0]
	};

	function station(i, kind, stop) {
		var s0 = stopS(i);
		var grp = new THREE.Group();
		grp.position.set(pathX(s0), 0, s0);
		scene.add(grp);
		var st = { i: i, kind: kind, s: s0, group: grp, life: 0, rise: true, update: function () {} };
		var hasVideo = !!stop.getAttribute('data-video');
		if (hasVideo && kind !== 'forest') {
			var at = SCREEN_AT[kind] || [2.2, -7];
			var scr = makeScreen(stop, i, kind === 'water' ? { h: 3.3 } : kind === 'bowling' || kind === 'tennis' ? { h: 3.0 } : kind === 'anatomy' ? { h: 3.1 } : {});
			scr.userData.base = new THREE.Vector3(at[0], 1.35 + scr.userData.h / 2, at[1]);
			scr.rotation.y = -0.08;
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
		[[-W / 2, H / 2, T, H], [W / 2, H / 2, T, H], [0, H, W + T, T]].forEach(function (b) {
			var m = new THREE.Mesh(new THREE.BoxBufferGeometry(b[2], b[3], T), barMat);
			m.position.set(b[0], b[1], 0); gate.add(m);
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

	BUILD.court = function (st, grp) {
		st.floorKey = 'court'; st.floorAt = [0.6, -2.6];
		var ball = new THREE.Mesh(new THREE.SphereBufferGeometry(0.17, 32, 20), std(0xff8a3a, { emissive: 0xff5a1a, emissiveIntensity: 0.7, roughness: 0.5 }));
		grp.add(ball);
		var ballGlow = new THREE.Mesh(new THREE.PlaneBufferGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff3fb4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
		ballGlow.rotation.x = -Math.PI / 2; ballGlow.position.y = 0.02;
		grp.add(ballGlow);
		var score = textTex(512, 256), home = 0, away = 0, shown = '';
		var scoreMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: score.t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
		scoreMesh.rotation.x = -Math.PI / 2;
		scoreMesh.position.set(1.2, 0.02, -5.6);
		grp.add(scoreMesh);
		function drawScore() {
			var s = home + '   ' + away; if (s === shown) return; shown = s;
			var g = score.g; g.clearRect(0, 0, 512, 256);
			g.fillStyle = '#fff'; g.font = '800 170px Archivo, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
			g.fillText(String(home), 150, 132); g.fillText(String(away), 362, 132);
			score.t.needsUpdate = true;
		}
		drawScore();
		st.onStep = function () {
			if (st.life < 0.6) return;
			st.stepCount = (st.stepCount || 0) + 1;
			if (st.stepCount % 4 === 0) { if (Math.random() < 0.5) home = (home + 1) % 10; else away = (away + 1) % 10; drawScore(); }
		};
		st.update = function (t, life) {
			var x = 1.0 + 2.4 * Math.sin(t * 0.8), z = -6.2 + 1.3 * Math.sin(t * 1.27);
			var bounce = Math.abs(Math.sin(t * 3.4));
			ball.position.set(x, 0.17 + bounce * 1.3 * life, z);
			ball.scale.setScalar(Math.max(0.001, life));
			ballGlow.position.set(x, 0.02, z);
			ballGlow.material.opacity = life * (1 - bounce * 0.7);
			scoreMesh.material.opacity = life;
			if (bounce < 0.05 && life > 0.5 && (!st.lastB || t - st.lastB > 0.3)) { st.lastB = t; addRipple(grp.position.x + x, grp.position.z + z, 0.7 * life); }
		};
	};

	BUILD.water = function (st, grp) {
		st.floorKey = 'water'; st.floorAt = [0.4, -2.0];
		var n = coarse ? 160 : 360, pos = new Float32Array(n * 3), seed = new Float32Array(n);
		for (var i = 0; i < n; i++) { pos[i * 3] = -4 + Math.random() * 9; pos[i * 3 + 1] = Math.random() * 4; pos[i * 3 + 2] = -9 + Math.random() * 5; seed[i] = Math.random(); }
		var geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		var mat = new THREE.PointsMaterial({ color: 0xbfefff, size: 0.05, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex });
		grp.add(new THREE.Points(geo, mat));
		st.stepBoost = 1.7;
		st.update = function (t, life, dt) {
			mat.opacity = 0.8 * life;
			for (var i = 0; i < n; i++) { pos[i * 3 + 1] += dt * (0.12 + seed[i] * 0.25); if (pos[i * 3 + 1] > 4) pos[i * 3 + 1] = 0; }
			geo.attributes.position.needsUpdate = true;
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
		kiosk.position.set(2.9, 0, -4.2);
		kiosk.rotation.y = -0.35;
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
		(function () {
			var g = ui.g; g.strokeStyle = '#3fe0e0'; g.lineWidth = 6; g.strokeRect(10, 10, 236, 424);
			g.fillStyle = 'rgba(63,224,224,0.9)'; g.fillRect(10, 10, 236, 8);
			g.font = '600 18px Archivo, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
			['Choose glasses', 'Take a photo'].forEach(function (l, i) {
				var x = 18 + i * 116; g.fillStyle = 'rgba(10,30,32,0.85)'; g.fillRect(x, 384, 104, 36);
				g.fillStyle = '#e8ffff'; g.fillText(l, x + 52, 402);
			});
		})();
		ui.t.needsUpdate = true;
		var uiMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.95, 1.65), new THREE.MeshBasicMaterial({ map: ui.t, transparent: true, fog: false }));
		uiMesh.position.set(0, 1.35, 0.058); kiosk.add(uiMesh);
		st.update = function (t, life) {
			var on = smooth(0.25, 0.8, life);
			kiosk.position.y = -(1 - easeOut(smooth(0, 0.5, life))) * 2.4;
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
		st.floorKey = 'grass'; st.floorAt = [0.9, -5.2];
		var lines = textTex(512, 1024), g = lines.g;
		g.strokeStyle = '#fff'; g.lineWidth = 10;
		g.strokeRect(40, 40, 432, 944); g.strokeRect(100, 40, 312, 944);
		g.beginPath(); g.moveTo(100, 300); g.lineTo(412, 300); g.moveTo(100, 724); g.lineTo(412, 724); g.moveTo(256, 300); g.lineTo(256, 724); g.stroke();
		lines.t.needsUpdate = true;
		var court = new THREE.Mesh(new THREE.PlaneBufferGeometry(4.2, 8.4), new THREE.MeshBasicMaterial({ map: lines.t, color: 0xeaffb0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
		court.rotation.x = -Math.PI / 2; court.position.set(0.9, 0.014, -6.2);
		grp.add(court);
		var netTex = ledGrid.clone(); netTex.needsUpdate = true; netTex.repeat.set(60, 12);
		var net = new THREE.Group();
		var mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(4.6, 0.9), new THREE.MeshBasicMaterial({ map: netTex, color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
		mesh.position.y = 0.45; net.add(mesh);
		var tape = new THREE.Mesh(new THREE.BoxBufferGeometry(4.6, 0.06, 0.03), std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 }));
		tape.position.y = 0.92; net.add(tape);
		[-2.35, 2.35].forEach(function (x) { var post = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.035, 0.035, 1.0, 12), std(0x1a1d1a, { metalness: 0.6, roughness: 0.4 })); post.position.set(x, 0.5, 0); net.add(post); });
		net.position.set(0.9, 0, -6.2);
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
			var z = -2.6 - 7.2 * f, x = 0.9 + Math.sin(phase * 1.7) * 1.1;
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
		g.fillStyle = '#111'; g.font = '800 170px Archivo, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
		g.fillText('BOSS', 512, 136); logo.t.needsUpdate = true;
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

	// Lusail lights festival: fireworks over the floor, bursting where you step.
	BUILD.fireworks = function (st, grp) {
		st.floorKey = 'water'; st.floorAt = [0.6, -3.0];
		var B = coarse ? 4 : 7, P = 90, bursts = [];
		var cols = [0xff4fd8, 0xffd04a, 0x58e0ff, 0xff6a3a, 0xa77bff];
		for (var b = 0; b < B; b++) {
			var pos = new Float32Array(P * 3), vel = new Float32Array(P * 3);
			var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
			var mat = new THREE.PointsMaterial({ color: cols[b % cols.length], size: 0.16, map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
			var pts = new THREE.Points(geo, mat); pts.frustumCulled = false; grp.add(pts);
			bursts.push({ pos: pos, vel: vel, geo: geo, mat: mat, age: 9, delay: b * 0.45 });
		}
		function fire(bu, x, y, z) {
			bu.age = 0;
			for (var i = 0; i < P; i++) {
				var u = Math.random() * 2 - 1, a = Math.random() * 6.283, s = Math.sqrt(1 - u * u), v = 2.4 + Math.random() * 0.6;
				bu.pos[i * 3] = x; bu.pos[i * 3 + 1] = y; bu.pos[i * 3 + 2] = z;
				bu.vel[i * 3] = s * Math.cos(a) * v; bu.vel[i * 3 + 1] = u * v; bu.vel[i * 3 + 2] = s * Math.sin(a) * v;
			}
		}
		var next = 0;
		st.onStep = function () { if (st.life > 0.6) { next = 0; } };
		st.update = function (t, life, dt) {
			next -= dt;
			if (life > 0.4 && next <= 0) {
				var bu = bursts.reduce(function (a, c) { return c.age > a.age ? c : a; });
				var x = -2.5 + Math.random() * 6, z = -9 + Math.random() * 4;
				fire(bu, x, 2.4 + Math.random() * 1.4, z);
				addRipple(grp.position.x + x, grp.position.z + z + 2, 0.8);
				next = 0.35 + Math.random() * 0.5;
			}
			bursts.forEach(function (bu) {
				bu.age += dt;
				var a = bu.age;
				bu.mat.opacity = life * Math.max(0, 1 - a / 1.6);
				if (a > 1.7) return;
				var drag = Math.exp(-dt * 1.6);
				for (var i = 0; i < P; i++) {
					bu.vel[i * 3] *= drag; bu.vel[i * 3 + 1] = bu.vel[i * 3 + 1] * drag - 0.9 * dt; bu.vel[i * 3 + 2] *= drag;
					bu.pos[i * 3] += bu.vel[i * 3] * dt; bu.pos[i * 3 + 1] += bu.vel[i * 3 + 1] * dt; bu.pos[i * 3 + 2] += bu.vel[i * 3 + 2] * dt;
				}
				bu.geo.attributes.position.needsUpdate = true;
			});
		};
	};

	// Dubai Police 360 VR: a future Dubai skyline with a shield over it.
	BUILD.city = function (st, grp) {
		st.floorKey = 'grid'; st.floorAt = [0.6, -3.4];
		var win = textTex(64, 128), wg = win.g;
		wg.fillStyle = '#071a1a'; wg.fillRect(0, 0, 64, 128);
		for (var yy = 4; yy < 128; yy += 8) for (var xx = 4; xx < 64; xx += 10) { wg.fillStyle = Math.random() < 0.55 ? 'rgba(120,255,225,' + (0.35 + Math.random() * 0.5) + ')' : 'rgba(40,90,90,0.4)'; wg.fillRect(xx, yy, 6, 4); }
		win.t.needsUpdate = true; win.t.wrapS = win.t.wrapT = THREE.RepeatWrapping;
		var city = new THREE.Group(), towers = [];
		var bmat = new THREE.MeshStandardMaterial({ color: 0x0c2427, emissive: 0xffffff, emissiveMap: win.t, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.6 });
		for (var i = 0; i < 26; i++) {
			var w = 0.3 + Math.random() * 0.45, h = 0.8 + Math.pow(Math.random(), 1.6) * 3.2;
			var geo = new THREE.BoxBufferGeometry(w, h, w);
			var m = new THREE.Mesh(geo, bmat);
			var ang = (i / 26) * Math.PI * 1.1 - 0.15, rad = 4.2 + Math.random() * 2.2;
			m.position.set(Math.cos(ang) * rad * 1.3 - 1.0, h / 2, -6.5 - Math.sin(ang) * rad * 0.55);
			m.userData.h = h; city.add(m); towers.push(m);
		}
		// the tallest tower, tapering in steps
		var burj = new THREE.Group();
		[[0.5, 2.2], [0.36, 1.8], [0.24, 1.4], [0.14, 1.1], [0.05, 0.9]].reduce(function (y, d) {
			var m = new THREE.Mesh(new THREE.CylinderBufferGeometry(d[0] * 0.8, d[0], d[1], 6), bmat);
			m.position.y = y + d[1] / 2; burj.add(m); return y + d[1];
		}, 0);
		burj.position.set(0.6, 0, -9.6); city.add(burj);
		grp.add(city);
		var dome = new THREE.Mesh(new THREE.SphereBufferGeometry(6.2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3ff0c8, wireframe: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
		dome.position.set(1.4, 0, -9.5); dome.scale.set(0.9, 0.6, 0.6); grp.add(dome);
		var shield = new THREE.Group();
		var ring1 = new THREE.Mesh(new THREE.TorusBufferGeometry(0.62, 0.02, 8, 80), new THREE.MeshBasicMaterial({ color: 0x5ffff0 }));
		var ring2 = new THREE.Mesh(new THREE.TorusBufferGeometry(0.78, 0.008, 8, 80, Math.PI * 1.5), new THREE.MeshBasicMaterial({ color: 0x5ffff0 }));
		var sh = new THREE.Shape(); sh.moveTo(0, 0.4); sh.quadraticCurveTo(0.2, 0.32, 0.32, 0.34); sh.quadraticCurveTo(0.32, -0.1, 0, -0.4); sh.quadraticCurveTo(-0.32, -0.1, -0.32, 0.34); sh.quadraticCurveTo(-0.2, 0.32, 0, 0.4);
		var shieldMesh = new THREE.Mesh(new THREE.ShapeBufferGeometry(sh, 24), new THREE.MeshBasicMaterial({ color: 0x3ff0c8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
		shield.add(ring1, ring2, shieldMesh);
		shield.position.set(-0.5, 3.0, -6.0); grp.add(shield);
		// the ride pod, the metro and the flying cars from the 360 VR film
		// the ride pod flies in over the skyline, open end towards us
		var pod = new THREE.Group(), podBody = new THREE.Group(), metro = new THREE.Group(), cars = [];
		var POD_D = [-3.3, 4.5, -11.0], POD_M = [-0.9, 6.2, -12.5], POD = mobile ? POD_M : POD_D;
		pod.add(podBody); podBody.rotation.y = Math.PI - 0.6; podBody.scale.setScalar(0.78);
		grp.add(pod);
		var podGlow = new THREE.PointLight(0x7ffff0, 0, 6, 2); podGlow.position.set(0.3, 0.2, 1.2); pod.add(podGlow);
		var podFill = new THREE.PointLight(0xffffff, 0, 7, 2); podFill.position.set(1.5, 1.4, 2.6); pod.add(podFill);
		var thrust = [];
		[-0.55, 0.55].forEach(function (x) {
			var f = new THREE.Mesh(new THREE.PlaneBufferGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x5ffff0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
			f.position.set(x, -0.9, 0.3); f.scale.setScalar(0.6); pod.add(f); thrust.push(f);
		});
		var podPad = new THREE.Mesh(new THREE.RingBufferGeometry(1.4, 1.5, 64), new THREE.MeshBasicMaterial({ color: 0x5ffff0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
		podPad.rotation.x = -Math.PI / 2; podPad.position.set(POD[0], 0.02, POD[2]); grp.add(podPad);
		metro.position.set(0, 4.2, -15); grp.add(metro);
		var rail = new THREE.Mesh(new THREE.BoxBufferGeometry(120, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x0a1416, emissive: 0x2ad6b4, emissiveIntensity: 0.6 }));
		rail.position.set(0, 3.35, -15); grp.add(rail);
		var CARS = [{ n: 'carA', c: [-879.59, 4.47, 584.64], len: 39.5 }, { n: 'carB', c: [-1077.0, 4.47, 963.4], len: 32.5 }];
		st.lazy = function () {
			loadModel('media/models/cockpit.glb', function (m) {
				// centre it so it banks around its middle
				m.position.set(-0.56, -1.1, 0.2);
				m.traverse(function (o) { if (o.isMesh && o.material) { o.material.metalness = Math.min(o.material.metalness, 0.5); o.material.roughness = Math.max(o.material.roughness, 0.35); } });
				podBody.add(m);
			});
			loadModel('media/models/metro.glb', function (m) { m.scale.setScalar(1.2); metro.add(m); });
			CARS.forEach(function (cd, k) {
				loadModel('media/models/cars.glb', function (m) {
					var piv = new THREE.Group(), keep = null;
					m.traverse(function (o) { if (o.name === cd.n && !keep && o.isMesh !== undefined) keep = o; });
					m.traverse(function (o) { if (o.isMesh) { var p = o; var mine = false; while (p) { if (p === keep) mine = true; p = p.parent; } o.visible = mine; } });
					m.position.set(-cd.c[0], -cd.c[1], -cd.c[2]);
					piv.add(m); piv.scale.setScalar(4.4 / cd.len);
					var holder = new THREE.Group(); holder.add(piv); grp.add(holder);
					cars.push({ o: holder, k: k });
				});
			});
		};
		st.update = function (t, life) {
			var fly = easeOut(smooth(0.05, 0.85, life));
			POD = mobile ? POD_M : POD_D; podPad.position.set(POD[0], 0.02, POD[2]);
			pod.visible = life > 0.01;
			pod.position.set(POD[0] - (1 - fly) * 14, POD[1] + Math.sin(t * 1.1) * 0.12 + (1 - fly) * 1.5, POD[2] + (1 - fly) * 2);
			pod.rotation.set(Math.sin(t * 0.8) * 0.03, Math.sin(t * 0.35) * 0.12, (1 - fly) * 0.35 + Math.sin(t * 0.9) * 0.04);
			podGlow.intensity = 3.0 * smooth(0.4, 1, life);
			podFill.intensity = 1.6 * smooth(0.4, 1, life);
			thrust.forEach(function (f, j) { f.material.opacity = smooth(0.2, 0.8, life) * (0.75 + 0.25 * Math.sin(t * 17 + j)); f.lookAt(camera.position); });
			podPad.material.opacity = 0.45 * smooth(0.6, 1, life) * (0.7 + 0.3 * Math.sin(t * 3));
			metro.visible = life > 0.2;
			metro.position.x = 70 - ((t * 9) % 150);
			var kr = smooth(0.2, 0.7, life); rail.scale.set(1, Math.max(0.001, kr), Math.max(0.001, kr)); rail.visible = kr > 0.01;
			cars.forEach(function (c) {
				var dir = c.k ? -1 : 1, sp = c.k ? 5.5 : 4.2, span = 34;
				var x = dir * (((t * sp + c.k * 13) % span) - span / 2);
				c.o.position.set(x, c.k ? 3.1 : 1.9, c.k ? -10.5 : -8.8);
				c.o.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
				c.o.visible = life > 0.3;
			});
			towers.forEach(function (m, j) { var k = smooth(j / 40, j / 40 + 0.5, life); m.scale.set(1, Math.max(0.001, k), 1); m.position.y = m.userData.h * k / 2; });
			var kb = smooth(0.2, 0.8, life); burj.scale.set(1, Math.max(0.001, kb), 1);
			city.visible = life > 0.01;
			dome.material.opacity = 0.07 * smooth(0.5, 1, life) * (0.7 + 0.3 * Math.sin(t * 2));
			dome.rotation.y = t * 0.05;
			var ks = smooth(0.55, 1, life);
			shield.scale.setScalar(Math.max(0.001, ks)); shield.visible = ks > 0.01;
			shield.position.y = 3.0 + Math.sin(t * 1.2) * 0.06;
			ring2.rotation.z = -t * 1.2; shield.rotation.y = Math.sin(t * 0.6) * 0.4;
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
			holder.scale.setScalar(Math.max(0.001, k));
			holder.visible = k > 0.005;
			holder.position.set(1.7, 1.85 + Math.sin(t * 1.3) * 0.06, -4.0);
			ry = damp(ry, mouse.x * 1.4 + t * 0.15, 3, dt);
			rx = damp(rx, -mouse.y * 0.6, 3, dt);
			brain.rotation.set(rx, ry, 0);
			handWorld(hand);
			holder.getWorldPosition(target);
			target.x -= 0.3; target.y -= 0.1; target.z += 0.2;
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

	/* ---------- Loop ---------- */

	var panels = stops.map(function (s) { return s.querySelector('.panel'); });
	var hudFill = document.querySelector('.track-fill');
	var hudChapter = document.querySelector('.hud-chapter');
	var lastChapter = null;
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

		var targetS = scrollToS(window.scrollY);
		// a jump across several stops (a nav link) skips ahead instead of sprinting
		if (Math.abs(targetS - charS) > S * 2.5) charS = targetS - Math.sign(targetS - charS) * S * 0.9;
		var prevS = charS;
		charS = damp(charS, targetS, 2.8, dt);
		var ds = charS - prevS;
		// how hard he is walking, from how fast he covers ground
		var speed = Math.abs(ds) / Math.max(dt, 1e-3);
		pose.move = damp(pose.move, Math.min(1, speed / 0.9), speed > 0.05 ? 6 : 3, dt);
		var px0 = pathX(charS);
		var near = nearest();

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
		skyU.uLed.value.copy(led);
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
			st.group.visible = vis;
			if (!vis) { if (st.hide) st.hide(); return; }
			if (st.lazy && st.life > 0.005) { st.lazy(); st.lazy = null; }
			if (st.screen) {
				var sc = st.screen, b = sc.userData.base;
				if (b) {
					var rise = easeOut(smooth(0, 0.55, st.life));
					sc.position.set(b.x - (mobile ? b.x - 0.2 : 0), b.y + (mobile ? 1.5 : 0) - (1 - rise) * (sc.userData.h + 1.6), b.z);
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
		if (pose.move < 0.1) want = 0.18 * Math.sin(t * 0.3) + (camera.position.x - px0) * 0.05;
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
		sky.position.set(px0, 30, charS - 62);
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

		if (composer) composer.render(dt); else renderer.render(scene, camera);
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
})();
