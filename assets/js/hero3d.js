/*
	Burhan Ahmad portfolio.

	Floor (3D intro): a particle LED floor modelled on the footstep floors in the
	work. Particles drift like water, swirl and part around the visitor (cursor or
	touch), ripples run out from each step, holding the button raises a column of
	light like the Ultra Instinct piece, and a click drops a splash.

	Wall (3D work): every project is a screen on a curved strip. Drag or throw it,
	use the tabs, arrows or keyboard; the screen in the middle plays and its
	details show below. Clicking the middle screen opens the full video.

	Backroom (About and Contact, both modes): a dim LED panel whose tiles light
	under the cursor or finger and fade like footsteps; clicks send a ring.

	Lite (no WebGL, reduced motion, weak devices): a looping clip behind the intro
	and the plain project list.
*/
(function () {
	var root = document.documentElement;
	var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
	var isTouch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
	var forced = /[?&]3d\b/.test(location.search);

	// ------------------------------------------------------------ project data
	var projects = [].slice.call(document.querySelectorAll('.project')).map(function (el) {
		var video = el.querySelector('video');
		var paras = [].slice.call(el.querySelectorAll('.text p'));
		var arText = (el.querySelector('.media').style.getPropertyValue('--ar') || '16 / 9').split('/');
		return {
			el: el,
			title: el.querySelector('h3').textContent,
			meta: el.querySelector('.meta').textContent,
			desc: paras.filter(function (p) { return !p.classList.contains('meta') && !p.classList.contains('tools'); }).map(function (p) { return p.textContent; }).join(' '),
			tools: el.querySelector('.tools').textContent,
			src: video.querySelector('source').getAttribute('src'),
			poster: video.getAttribute('poster'),
			full: video.getAttribute('data-full'),
			group: el.closest('.group').querySelector('h2').textContent,
			ar: parseFloat(arText[0]) / parseFloat(arText[1] || 1)
		};
	});

	function play(v) {
		var p = v.play();
		if (p && p.catch) p.catch(function () {});
	}

	// ------------------------------------------------------------ project list (lite)
	if ('IntersectionObserver' in window && !reduceMotion) {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (e) {
				if (!root.classList.contains('is-lite')) return;
				if (e.isIntersecting) play(e.target); else e.target.pause();
			});
		}, { threshold: 0.4 });
		projects.forEach(function (p) { io.observe(p.el.querySelector('video')); });
	}

	// ------------------------------------------------------------ full video player
	var player = document.querySelector('.player');
	var playerVideo = player.querySelector('video');
	function openPlayer(project) {
		playerVideo.onerror = function () {
			if (playerVideo.getAttribute('src') !== project.src) {
				playerVideo.setAttribute('src', project.src);
				play(playerVideo);
			}
		};
		playerVideo.setAttribute('src', project.full || project.src);
		playerVideo.muted = false;
		if (player.showModal) player.showModal(); else player.setAttribute('open', '');
		play(playerVideo);
	}
	function closePlayer() {
		playerVideo.pause();
		playerVideo.removeAttribute('src');
		playerVideo.load();
		if (player.close) player.close(); else player.removeAttribute('open');
	}
	projects.forEach(function (p) {
		p.el.querySelector('.media').addEventListener('click', function () { openPlayer(p); });
	});
	player.querySelector('.player-close').addEventListener('click', closePlayer);
	player.addEventListener('cancel', function (e) { e.preventDefault(); closePlayer(); });
	player.addEventListener('click', function (e) { if (e.target === player) closePlayer(); });

	// ------------------------------------------------------------ nav
	var nav = document.querySelector('.nav');
	var floorSection = document.querySelector('.floor');
	function updateNav() { nav.classList.toggle('is-solid', floorSection.getBoundingClientRect().bottom < 80); }
	window.addEventListener('scroll', updateNav, { passive: true });
	updateNav();

	// ------------------------------------------------------------ lite intro
	function startLite() {
		var v = document.querySelector('.lite-reel');
		// Portrait screens get the portrait floor clip, wide ones the landscape kiosk.
		var clip = innerWidth > innerHeight ? 'ar-tryon' : 'loewe';
		v.poster = 'media/hq/' + clip + '.jpg';
		if (reduceMotion) return; // the poster is enough
		v.src = 'media/hq/' + clip + '.mp4' + (clip === 'ar-tryon' ? '#t=6' : '');
		play(v);
	}

	// ------------------------------------------------------------ backroom
	// Behind About and Contact: a dim LED panel. Tiles light up under the
	// visitor and fade like footsteps; a click or tap sends a ring across it.
	// When nobody is around, a faint light drifts over it on its own.
	function makeBackroom() {
		var wrap = document.querySelector('.backroom');
		var canvas = wrap && wrap.querySelector('.backroom-led');
		if (!canvas || reduceMotion || !canvas.getContext) return;
		var ctx = canvas.getContext('2d');
		var STEP = 22, cols = 0, rows = 0, field = null, dpr = 1;
		var rings = [], last = null, lastInput = -1e9, visible = false, raf = 0, prev = 0;

		function size() {
			var w = wrap.clientWidth, h = wrap.clientHeight;
			// Sharp on retina, but keep the canvas under ~6 MP on long phone pages.
			dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6e6 / Math.max(1, w * h))));
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			cols = Math.ceil(w / STEP);
			rows = Math.ceil(h / STEP);
			field = new Float32Array(cols * rows);
		}

		// Light the tiles around a point, in page pixels relative to the panel.
		function stamp(x, y, amount, radius) {
			var cx = x / STEP - 0.5, cy = y / STEP - 0.5, r = Math.ceil(radius * 2);
			var c0 = Math.max(0, Math.floor(cx - r)), c1 = Math.min(cols - 1, Math.ceil(cx + r));
			var r0 = Math.max(0, Math.floor(cy - r)), r1 = Math.min(rows - 1, Math.ceil(cy + r));
			for (var j = r0; j <= r1; j++) for (var i = c0; i <= c1; i++) {
				var dx = i - cx, dy = j - cy;
				var k = j * cols + i;
				field[k] = Math.min(1, field[k] + amount * Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius)));
			}
		}
		function walk(x, y) {
			if (last) {
				var dx = x - last.x, dy = y - last.y, n = Math.min(12, Math.ceil(Math.hypot(dx, dy) / (STEP * 0.75)));
				for (var s = 1; s <= n; s++) stamp(last.x + dx * s / n, last.y + dy * s / n, 0.32, 2.4);
			} else stamp(x, y, 0.4, 2.4);
			last = { x: x, y: y };
			lastInput = performance.now();
		}
		function local(e) {
			var b = wrap.getBoundingClientRect();
			return { x: e.clientX - b.left, y: e.clientY - b.top };
		}

		wrap.addEventListener('pointermove', function (e) { var p = local(e); walk(p.x, p.y); });
		wrap.addEventListener('pointerleave', function () { last = null; });
		wrap.addEventListener('pointerdown', function (e) {
			var p = local(e);
			rings.push({ x: p.x, y: p.y, t: performance.now() });
			if (rings.length > 6) rings.shift();
			lastInput = performance.now();
		});
		wrap.addEventListener('touchmove', function (e) {
			var t = e.touches[0]; if (!t) return;
			var p = local(t); walk(p.x, p.y);
		}, { passive: true });
		wrap.addEventListener('touchend', function () { last = null; }, { passive: true });

		function frame(now) {
			raf = visible ? requestAnimationFrame(frame) : 0;
			var dt = Math.min(0.05, (now - prev) / 1000 || 0.016);
			prev = now;

			// Idle: a soft light wanders slowly across the panel.
			if (now - lastInput > 4000) {
				var t = now / 1000;
				var x = (0.5 + 0.38 * Math.sin(t * 0.21) + 0.08 * Math.sin(t * 0.63)) * wrap.clientWidth;
				var y = (0.5 + 0.36 * Math.sin(t * 0.13 + 1.3)) * wrap.clientHeight;
				stamp(x, y, 0.05, 3.4);
			}

			var decay = Math.pow(0.3, dt); // keeps ~30% after one second
			var w = canvas.width, h = canvas.height, px = STEP * dpr;
			ctx.clearRect(0, 0, w, h);

			var live = [];
			for (var r = 0; r < rings.length; r++) {
				var age = (now - rings[r].t) / 1000;
				if (age < 2.2) live.push({ x: rings[r].x / STEP - 0.5, y: rings[r].y / STEP - 0.5, rad: age * 26, fade: 1 - age / 2.2 });
			}
			rings = rings.filter(function (g) { return now - g.t < 2200; });

			// Bucket brightness so the canvas only switches colour a few times.
			var buckets = [[], [], [], [], [], [], [], []];
			for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
				var k = j * cols + i;
				var v = field[k] *= decay;
				for (var q = 0; q < live.length; q++) {
					var d = Math.hypot(i - live[q].x, j - live[q].y) - live[q].rad;
					if (d > -2.5 && d < 2.5) v += 0.55 * live[q].fade * (1 - Math.abs(d) / 2.5);
				}
				if (v > 0.03) buckets[Math.min(7, Math.floor(v * 8))].push(k);
			}
			for (var b = 0; b < 8; b++) {
				var list = buckets[b];
				if (!list.length) continue;
				var lv = (b + 0.5) / 8;
				ctx.fillStyle = 'rgba(176, 200, 255, ' + (0.08 + lv * 0.4).toFixed(3) + ')';
				var sz = (2 + lv * 3) * dpr, off = (px - sz) / 2;
				for (var n = 0; n < list.length; n++) {
					var kk = list[n];
					ctx.fillRect((kk % cols) * px + off, Math.floor(kk / cols) * px + off, sz, sz);
				}
			}
		}

		size();
		if (window.ResizeObserver) new ResizeObserver(size).observe(wrap);
		else window.addEventListener('resize', size);
		new IntersectionObserver(function (entries) {
			visible = entries[0].isIntersecting;
			if (visible && !raf) { prev = performance.now(); raf = requestAnimationFrame(frame); }
		}).observe(wrap);
	}
	makeBackroom();

	if (!root.classList.contains('is-3d') || !window.THREE) { startLite(); return; }

	var floorApp, wallApp;
	try {
		floorApp = makeFloor(document.getElementById('scene'));
		wallApp = makeWall(document.getElementById('wall-scene'));
	} catch (e) {
		goLite();
		return;
	}

	var raf;
	function loop(now) {
		raf = requestAnimationFrame(loop);
		floorApp.frame(now);
		wallApp.frame(now);
	}
	raf = requestAnimationFrame(loop);

	function goLite() {
		if (raf) cancelAnimationFrame(raf);
		root.classList.remove('is-3d');
		root.classList.add('is-lite');
		[floorApp, wallApp].forEach(function (a) { if (a) a.dispose(); });
		startLite();
	}

	function visible(el) {
		var r = el.getBoundingClientRect();
		return r.bottom > 0 && r.top < window.innerHeight;
	}

	// ============================================================ FLOOR
	function makeFloor(container) {
		var renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
		var dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 1.75);
		renderer.setPixelRatio(dpr);
		renderer.setClearColor(0x000000, 1);
		container.appendChild(renderer.domElement);

		var scene = new THREE.Scene();
		var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
		var camBase = new THREE.Vector3(0, 9.5, 7.2);
		var camLook = new THREE.Vector3(0, 0, 0.4);

		var COUNT = isTouch ? 60000 : 140000;
		var TRAIL = 16;

		// Visitors: [x, z, presence]; lift raises a column under each one.
		var visitors = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
		var lifts = [0, 0];
		var trail = [], amps = [];
		for (var i = 0; i < TRAIL; i++) { trail.push(new THREE.Vector3(0, 0, -100)); amps.push(0); }
		var trailHead = 0;

		var uniforms = {
			uTime: { value: 0 },
			uSize: { value: isTouch ? 2.4 : 1.9 },
			uPR: { value: dpr },
			uField: { value: new THREE.Vector4(-10, 10, -6, 6) },
			uP: { value: visitors },
			uLift: { value: lifts },
			uTrail: { value: trail },
			uAmp: { value: amps }
		};

		var seeds = new Float32Array(COUNT * 4);
		for (i = 0; i < COUNT * 4; i++) seeds[i] = Math.random();
		var geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
		geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
		geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

		var particles = new THREE.Points(geo, new THREE.ShaderMaterial({
			uniforms: uniforms,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			vertexShader: [
				'uniform float uTime, uSize, uPR;',
				'uniform vec4 uField;',
				'uniform vec3 uP[2];',
				'uniform float uLift[2];',
				'uniform vec3 uTrail[' + TRAIL + '];',
				'uniform float uAmp[' + TRAIL + '];',
				'attribute vec4 seed;',
				'varying float vB;',
				'void main() {',
				'  float t = uTime;',
				'  vec2 p = vec2(mix(uField.x, uField.y, seed.x), mix(uField.z, uField.w, seed.y));',
				// Water-like drift
				'  p += vec2(sin(p.y * 0.55 + t * 0.35 + seed.z * 6.283), cos(p.x * 0.5 - t * 0.3 + seed.w * 6.283)) * 0.3;',
				'  p += vec2(sin(p.y * 1.7 - t * 0.6), cos(p.x * 1.9 + t * 0.5)) * 0.08;',
				'  float glow = 0.0, h = 0.0;',
				'  for (int i = 0; i < 2; i++) {',
				'    vec3 P = uP[i];',
				'    if (P.z < 0.001) continue;',
				'    vec2 d = p - P.xy;',
				'    float r2 = dot(d, d);',
				'    float k = exp(-r2 / 1.8) * P.z;',
				// Swirl around the feet, and part to leave a clear ring under them
				'    float a = k * (2.6 + 0.4 * sin(t * 0.9 + seed.z * 6.283));',
				'    float c = cos(a), s = sin(a);',
				'    d = vec2(c * d.x - s * d.y, s * d.x + c * d.y);',
				'    float rr = length(d) + 1e-4;',
				'    d += d / rr * 0.5 * exp(-r2 / 0.3) * P.z;',
				'    p = P.xy + d;',
				'    glow += k * 1.1;',
				// Column of light
				'    float col = exp(-r2 / (0.25 + 0.6 * seed.w));',
				'    h += uLift[i] * col * (0.3 + pow(seed.z, 1.6) * 5.5);',
				'    glow += uLift[i] * col * 0.8;',
				'  }',
				'  for (int i = 0; i < ' + TRAIL + '; i++) {',
				'    vec3 T = uTrail[i];',
				'    float age = t - T.z;',
				'    if (age < 0.0 || age > 4.0) continue;',
				'    vec2 d = p - T.xy;',
				'    float r = length(d) + 1e-3;',
				'    float ring = exp(-pow((r - age * 1.7) * 3.0, 2.0)) * exp(-age * 0.95) * uAmp[i];',
				'    p += d / r * ring * 0.22;',
				'    h += ring * 0.12;',
				'    glow += ring * 1.3;',
				'  }',
				'  vec4 mv = modelViewMatrix * vec4(p.x, h, p.y, 1.0);',
				'  gl_Position = projectionMatrix * mv;',
				'  vB = 0.16 + glow + seed.w * 0.12;',
				'  gl_PointSize = uSize * uPR * (0.55 + seed.z * 0.9) * (1.0 + min(glow, 2.0) * 0.45) * (10.0 / -mv.z);',
				'}'
			].join('\n'),
			fragmentShader: [
				'varying float vB;',
				'void main() {',
				'  float d = length(gl_PointCoord - 0.5);',
				'  if (d > 0.5) discard;',
				'  float b = clamp(vB, 0.0, 2.2);',
				'  vec3 deep = vec3(0.16, 0.34, 0.85);',
				'  vec3 ice = vec3(0.82, 0.93, 1.0);',
				'  vec3 col = mix(deep, ice, clamp(b * 0.75, 0.0, 1.0)) * b;',
				'  gl_FragColor = vec4(col, smoothstep(0.5, 0.0, d));',
				'}'
			].join('\n')
		}));
		scene.add(particles);

		// LED tiles under the particles: dark panels that light up near the visitors.
		var tiles = new THREE.Mesh(
			new THREE.PlaneGeometry(60, 40),
			new THREE.ShaderMaterial({
				uniforms: { uP: uniforms.uP, uLift: uniforms.uLift },
				vertexShader: 'varying vec2 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
				fragmentShader: [
					'uniform vec3 uP[2];',
					'uniform float uLift[2];',
					'varying vec2 vW;',
					'void main() {',
					'  vec2 id = floor(vW / 0.5);',
					'  vec2 c = (id + 0.5) * 0.5;',
					'  vec2 f = fract(vW / 0.5);',
					'  float seam = step(0.03, f.x) * step(f.x, 0.97) * step(0.03, f.y) * step(f.y, 0.97);',
					'  float g = 0.0;',
					'  for (int i = 0; i < 2; i++) g += exp(-dot(c - uP[i].xy, c - uP[i].xy) / 2.2) * uP[i].z * (0.6 + uLift[i]);',
					'  vec3 col = vec3(0.012, 0.016, 0.026) + vec3(0.05, 0.09, 0.2) * g;',
					'  col *= 0.55 + 0.45 * seam;',
					'  col *= smoothstep(16.0, 5.0, length(vW));',
					'  gl_FragColor = vec4(col, 1.0);',
					'}'
				].join('\n')
			})
		);
		tiles.rotation.x = -Math.PI / 2;
		tiles.position.y = -0.02;
		scene.add(tiles);

		// ---------------------------------------------- input
		var raycaster = new THREE.Raycaster();
		var ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
		var ndc = new THREE.Vector2(), hit = new THREE.Vector3();
		var target = new THREE.Vector2(0, 0.8);
		var pos = new THREE.Vector2(0, 0.8);
		var lastStep = new THREE.Vector2(99, 99);
		var lastInput = -1e9, holding = false, presence = 0;
		var pointerOver = false;
		var parallax = new THREE.Vector2(), parallaxS = new THREE.Vector2();

		function toFloor(cx, cy) {
			var r = container.getBoundingClientRect();
			ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
			raycaster.setFromCamera(ndc, camera);
			if (raycaster.ray.intersectPlane(ground, hit)) {
				target.set(hit.x, hit.z);
				lastInput = performance.now();
			}
			parallax.set(ndc.x, ndc.y);
		}
		function addRipple(x, z, amp) {
			trail[trailHead].set(x, z, uniforms.uTime.value);
			amps[trailHead] = amp;
			trailHead = (trailHead + 1) % TRAIL;
		}

		var stage = container.parentNode;
		stage.addEventListener('pointermove', function (e) { pointerOver = true; toFloor(e.clientX, e.clientY); }, { passive: true });
		stage.addEventListener('pointerleave', function () { pointerOver = false; holding = false; });
		stage.addEventListener('pointerdown', function (e) {
			if (e.target.closest('a, button')) return;
			pointerOver = true;
			toFloor(e.clientX, e.clientY);
			pos.copy(target);
			holding = true;
			addRipple(target.x, target.y, 2.2);
		});
		window.addEventListener('pointerup', function () { holding = false; });
		window.addEventListener('pointercancel', function () { holding = false; });

		// ---------------------------------------------- layout
		function layout() {
			var w = container.clientWidth, h = container.clientHeight;
			renderer.setSize(w, h);
			camera.aspect = w / h;
			camera.position.copy(camBase);
			if (camera.aspect < 1) camera.position.multiplyScalar(1 + (1 - camera.aspect) * 0.6);
			camera.updateProjectionMatrix();
			camera.lookAt(camLook);
			camera.updateMatrixWorld();
			// Fit the particle field to what the camera sees on the floor.
			var xs = [], zs = [];
			[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
				ndc.set(c[0], c[1]);
				raycaster.setFromCamera(ndc, camera);
				if (raycaster.ray.intersectPlane(ground, hit)) { xs.push(hit.x); zs.push(hit.z); }
				else { xs.push(c[0] * 30); zs.push(-30); }
			});
			var minZ = Math.max(Math.min.apply(null, zs), -14);
			uniforms.uField.value.set(Math.min.apply(null, xs) - 1, Math.max.apply(null, xs) + 1, minZ - 1, Math.max.apply(null, zs) + 1);
		}
		window.addEventListener('resize', layout);
		layout();

		// ---------------------------------------------- frame
		var clock = new THREE.Clock();
		var sampleStart = 0, sampleFrames = 0, sampling = true, downgraded = false;

		function frame(now) {
			if (!visible(container)) { clock.getDelta(); return; }
			var dt = Math.min(clock.getDelta(), 0.05);
			uniforms.uTime.value += dt;
			var t = uniforms.uTime.value;

			var idle = now - lastInput > 3500 && !holding;
			if (idle) {
				// A visitor wanders the floor until you take over.
				target.set(Math.sin(t * 0.23) * 3.2, 0.6 + Math.sin(t * 0.37 + 1.3) * 2.0);
			}
			var k = 1 - Math.pow(idle ? 0.25 : 0.0005, dt);
			pos.lerp(target, k);
			presence += ((pointerOver || idle ? 1 : 0.0) - presence) * (1 - Math.pow(0.02, dt));
			visitors[0].set(pos.x, pos.y, presence);
			lifts[0] += ((holding ? 1 : 0) - lifts[0]) * (1 - Math.pow(holding ? 0.15 : 0.04, dt));

			if (lastStep.distanceTo(pos) > 0.55) {
				addRipple(pos.x, pos.y, 1);
				lastStep.copy(pos);
			}

			parallaxS.lerp(parallax, 0.04);
			camera.position.set(camBase.x + parallaxS.x * 0.5, camBase.y, camBase.z - parallaxS.y * 0.3);
			if (camera.aspect < 1) camera.position.multiplyScalar(1 + (1 - camera.aspect) * 0.6);
			camera.lookAt(camLook);

			renderer.render(scene, camera);
			watchdog(now);
		}

		// Drop resolution, then switch to the lite page, if the device can't keep up.
		function watchdog(now) {
			if (!sampling || forced) return;
			if (!sampleStart) { sampleStart = now; sampleFrames = 0; return; }
			sampleFrames++;
			var elapsed = now - sampleStart;
			if (elapsed < 2500) return;
			var fps = sampleFrames / (elapsed / 1000);
			if (fps >= 28) { sampling = false; return; }
			if (!downgraded) {
				downgraded = true;
				renderer.setPixelRatio(1);
				uniforms.uPR.value = 1;
				layout();
				sampleStart = 0;
			} else {
				sampling = false;
				setTimeout(goLite, 0);
			}
		}
		document.addEventListener('visibilitychange', function () { if (!document.hidden) { sampleStart = 0; clock.getDelta(); } });

		function dispose() {
			renderer.dispose();
			if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
		}

		return { frame: frame, dispose: dispose };
	}

	// ============================================================ WALL
	function makeWall(container) {
		var section = container.closest('.wall');
		var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
		var dpr = Math.min(window.devicePixelRatio || 1, 2);
		renderer.setPixelRatio(dpr);
		renderer.setClearColor(0x0c0c0b, 1);
		container.appendChild(renderer.domElement);

		var scene = new THREE.Scene();
		var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
		camera.position.set(0, 0, 11.5);
		camera.lookAt(0, 0, 0);

		var H = 3.4, GAP = 0.45, R = 11;
		var loader = new THREE.TextureLoader();

		var panelGeo = new THREE.PlaneGeometry(1, 1, 32, 1);
		var vertex = [
			'uniform float uCenter, uW, uH, uR, uScale, uVel, uLift;',
			'varying vec2 vUv;',
			'void main() {',
			'  vUv = uv;',
			'  float x = position.x * uW * uScale;',
			'  float y = position.y * uH * uScale;',
			'  float s = uCenter + x;',
			'  float a = s / uR;',
			// Curved like an LED wall; throwing it makes the screens lean
			'  y += uVel * 0.05 * x;',
			'  vec3 w = vec3(uR * sin(a), y + uLift, uR * (1.0 - cos(a)) + uLift * 0.6);',
			'  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);',
			'}'
		].join('\n');
		var fragment = [
			'uniform sampler2D map;',
			'uniform float uTexAr, uPanelAr, uDim, uHover, uReady;',
			'varying vec2 vUv;',
			'void main() {',
			'  vec2 uv = vUv;',
			'  float r = uTexAr / uPanelAr;',
			'  if (r > 1.0) uv.x = (uv.x - 0.5) / r + 0.5; else uv.y = (uv.y - 0.5) * r + 0.5;',
			'  vec3 col = texture2D(map, uv).rgb * uReady + vec3(0.07) * (1.0 - uReady);',
			// Rounded corners
			'  vec2 q = abs(vUv - 0.5) * vec2(uPanelAr, 1.0);',
			'  vec2 b = vec2(uPanelAr, 1.0) * 0.5 - 0.035;',
			'  float dist = length(max(q - b, 0.0)) - 0.035;',
			'  float alpha = 1.0 - smoothstep(-0.004, 0.004, dist);',
			'  gl_FragColor = vec4(col * (uDim + uHover * 0.12), alpha);',
			'}'
		].join('\n');

		var panels = [];
		var cursor = 0;
		projects.forEach(function (p, i) {
			var ar = Math.max(0.56, Math.min(1.9, p.ar));
			var w = H * ar;
			var u = {
				map: { value: null },
				uCenter: { value: 0 }, uW: { value: w }, uH: { value: H }, uR: { value: R },
				uScale: { value: 0.85 }, uVel: { value: 0 }, uLift: { value: 0 },
				uTexAr: { value: p.ar }, uPanelAr: { value: ar },
				uDim: { value: 0.4 }, uHover: { value: 0 }, uReady: { value: 0 }
			};
			var mesh = new THREE.Mesh(panelGeo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: vertex, fragmentShader: fragment, transparent: true }));
			mesh.frustumCulled = false;
			scene.add(mesh);
			var panel = { project: p, mesh: mesh, u: u, w: w, s: cursor + w / 2, video: null, videoTex: null, posterTex: null, hover: 0 };
			cursor += w + GAP;
			loader.load(p.poster, function (t) {
				t.minFilter = THREE.LinearFilter;
				panel.posterTex = t;
				if (!u.map.value) { u.map.value = t; u.uReady.value = 1; }
			});
			panels.push(panel);
		});

		// ---------------------------------------------- scroll state
		var scroll = panels[0].s, scrollTarget = scroll, velocity = 0;
		var active = -1;
		var dragging = false, dragX = 0, dragStartX = 0, lastMoveT = 0, dragVel = 0, moved = 0;
		var hovered = -1;
		var hint = section.querySelector('.wall-hint');

		function nearest(s) {
			var best = 0, bd = Infinity;
			panels.forEach(function (p, i) { var d = Math.abs(p.s - s); if (d < bd) { bd = d; best = i; } });
			return best;
		}
		function goTo(i) {
			i = Math.max(0, Math.min(panels.length - 1, i));
			scrollTarget = panels[i].s;
		}

		function worldPerPixel() {
			var dist = camera.position.z;
			return 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / container.clientHeight;
		}

		container.addEventListener('pointerdown', function (e) {
			dragging = true;
			moved = 0;
			dragX = dragStartX = e.clientX;
			lastMoveT = performance.now();
			dragVel = 0;
			container.setPointerCapture(e.pointerId);
			container.classList.add('is-dragging');
		});
		container.addEventListener('pointermove', function (e) {
			updateHover(e);
			if (!dragging) return;
			var now = performance.now();
			var dx = e.clientX - dragX;
			dragX = e.clientX;
			moved = Math.max(moved, Math.abs(e.clientX - dragStartX));
			var dw = -dx * worldPerPixel() * 1.4;
			scroll += dw;
			scrollTarget = scroll;
			var dtm = Math.max(1, now - lastMoveT);
			dragVel = dragVel * 0.6 + (dw / dtm * 16) * 0.4;
			lastMoveT = now;
			if (moved > 8 && hint) hint.classList.add('is-gone');
		});
		function endDrag(e) {
			if (!dragging) return;
			dragging = false;
			container.classList.remove('is-dragging');
			if (moved < 6) {
				// A click: open the middle screen, or bring another to the middle.
				if (hovered === active && hovered >= 0) openPlayer(panels[active].project);
				else if (hovered >= 0) goTo(hovered);
				return;
			}
			// Throw: carry the momentum, then settle on the nearest screen.
			var landing = scroll + dragVel * 14;
			goTo(nearest(landing));
		}
		container.addEventListener('pointerup', endDrag);
		container.addEventListener('pointercancel', endDrag);
		container.addEventListener('pointerleave', function () { hovered = -1; container.classList.remove('is-pointing'); });

		section.querySelector('.wall-prev').addEventListener('click', function () { goTo(active - 1); });
		section.querySelector('.wall-next').addEventListener('click', function () { goTo(active + 1); });
		section.querySelector('.wall-watch').addEventListener('click', function () { if (active >= 0) openPlayer(panels[active].project); });
		var tabs = [].slice.call(section.querySelectorAll('.wall-tabs button'));
		tabs.forEach(function (b) {
			b.addEventListener('click', function () {
				var g = b.getAttribute('data-group');
				for (var i = 0; i < panels.length; i++) if (panels[i].project.group === g) { goTo(i); break; }
			});
		});
		window.addEventListener('keydown', function (e) {
			if (player.open || !visible(container)) return;
			var r = container.getBoundingClientRect();
			if (r.top > window.innerHeight * 0.6 || r.bottom < window.innerHeight * 0.4) return;
			if (e.key === 'ArrowRight') { goTo(active + 1); e.preventDefault(); }
			if (e.key === 'ArrowLeft') { goTo(active - 1); e.preventDefault(); }
		});

		// Hover: test the pointer against each screen's projected outline.
		var v3 = new THREE.Vector3();
		function project(x, y, z) {
			v3.set(x, y, z).project(camera);
			return { x: (v3.x + 1) / 2 * container.clientWidth, y: (1 - v3.y) / 2 * container.clientHeight };
		}
		function updateHover(e) {
			var r = container.getBoundingClientRect();
			var px = e.clientX - r.left, py = e.clientY - r.top;
			hovered = -1;
			for (var i = 0; i < panels.length; i++) {
				var p = panels[i], u = p.u;
				var c = u.uCenter.value, hw = u.uW.value * u.uScale.value / 2, hh = u.uH.value * u.uScale.value / 2;
				var a0 = (c - hw) / R, a1 = (c + hw) / R;
				if (Math.abs(a0) > 1.4 && Math.abs(a1) > 1.4) continue;
				var tl = project(R * Math.sin(a0), hh + u.uLift.value, R * (1 - Math.cos(a0)));
				var br = project(R * Math.sin(a1), -hh + u.uLift.value, R * (1 - Math.cos(a1)));
				if (px >= Math.min(tl.x, br.x) && px <= Math.max(tl.x, br.x) && py >= Math.min(tl.y, br.y) && py <= Math.max(tl.y, br.y)) { hovered = i; break; }
			}
			container.classList.toggle('is-pointing', hovered >= 0 && !dragging);
		}

		// ---------------------------------------------- caption
		var cIndex = section.querySelector('.wall-index');
		var info = section.querySelector('.wall-info');
		var cTitle = section.querySelector('.wall-title'), cMeta = section.querySelector('.wall-meta');
		var cDesc = section.querySelector('.wall-desc'), cTools = section.querySelector('.wall-tools');
		section.querySelector('.wall-total').textContent = ('0' + panels.length).slice(-2);
		var swapTimer;
		function setActive(i) {
			if (i === active) return;
			var prev = active;
			active = i;
			var p = panels[i].project;
			info.classList.add('is-swapping');
			clearTimeout(swapTimer);
			swapTimer = setTimeout(function () {
				cIndex.textContent = ('0' + (i + 1)).slice(-2);
				cTitle.textContent = p.title;
				cMeta.textContent = p.meta;
				cDesc.textContent = p.desc;
				cTools.textContent = p.tools;
				info.classList.remove('is-swapping');
			}, prev < 0 ? 0 : 180);
			tabs.forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-group') === p.group); });
			updateVideos();
		}

		// Only the middle screen plays.
		function updateVideos() {
			var inView = visible(container);
			panels.forEach(function (p, i) {
				var on = i === active && inView;
				if (on && !p.video) {
					var v = document.createElement('video');
					v.muted = true; v.loop = true; v.playsInline = true;
					v.setAttribute('playsinline', '');
					v.preload = 'auto';
					v.src = p.project.src;
					v.addEventListener('canplay', function () {
						if (!p.videoTex) {
							p.videoTex = new THREE.VideoTexture(v);
							p.videoTex.minFilter = THREE.LinearFilter;
						}
						if (i === active) { p.u.map.value = p.videoTex; p.u.uReady.value = 1; }
					});
					p.video = v;
				}
				if (!p.video) return;
				if (on) {
					play(p.video);
					if (p.videoTex) p.u.map.value = p.videoTex;
				} else {
					p.video.pause();
				}
			});
		}

		// ---------------------------------------------- layout
		function layout() {
			var w = container.clientWidth, h = container.clientHeight;
			renderer.setSize(w, h);
			camera.aspect = w / h;
			// Stay at the centre of the curve and zoom so the middle screen fills
			// ~80% of the stage height, never more than ~86% of its width.
			var view = Math.max(H / 0.8, H * 1.9 / ((camera.aspect < 1 ? 0.94 : 0.86) * camera.aspect));
			camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(view / (2 * camera.position.z)));
			camera.updateProjectionMatrix();
		}
		window.addEventListener('resize', layout);
		layout();

		var wasVisible = false;
		var last = performance.now();
		function frame(now) {
			var inView = visible(container);
			if (inView !== wasVisible) { wasVisible = inView; updateVideos(); }
			var dt = Math.min((now - last) / 1000, 0.05);
			last = now;
			if (!inView) return;

			if (!dragging) {
				var prevScroll = scroll;
				scroll += (scrollTarget - scroll) * (1 - Math.pow(0.003, dt));
				velocity = (scroll - prevScroll) / Math.max(dt, 1e-3);
			} else {
				velocity = dragVel / 0.016;
			}
			setActive(nearest(scroll));

			panels.forEach(function (p, i) {
				var u = p.u;
				var isActive = i === active;
				p.hover += ((i === hovered && !dragging ? 1 : 0) - p.hover) * 0.15;
				u.uCenter.value = p.s - scroll;
				u.uScale.value += ((isActive ? 1 : 0.84) - u.uScale.value) * 0.12;
				u.uDim.value += ((isActive ? 1 : 0.38) - u.uDim.value) * 0.1;
				u.uHover.value = p.hover;
				u.uLift.value = p.hover * 0.08;
				u.uVel.value += (Math.max(-3, Math.min(3, velocity * 0.25)) - u.uVel.value) * 0.2;
				if (!isActive && p.posterTex && u.map.value !== p.posterTex && (!p.video || p.video.paused)) {
					// Keep the last frame as a still; fall back to the poster when nothing loaded.
					if (!p.videoTex) u.map.value = p.posterTex;
				}
			});

			renderer.render(scene, camera);
		}

		function dispose() {
			panels.forEach(function (p) { if (p.video) { p.video.pause(); p.video.removeAttribute('src'); } });
			renderer.dispose();
			if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
		}

		return { frame: frame, dispose: dispose };
	}
})();
