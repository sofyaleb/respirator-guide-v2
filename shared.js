// The mask data, the models to look for, and the animated face drawing used on the guide.
window.RG = (() => {
  // In protection order. weight: on the face or head; carried: worn elsewhere (belt fan and battery).
  // pf: protection factor (UK HSE / US OSHA rating; typical study values for cloth,
  // surgical and ear-loop). filter: share of particles that pass through the filter itself, used only to
  // colour the animation; the rest of 1/pf slips in round the edges. style: how the face scene draws it.
  const MASKS = [
    { id: 'none', name: 'No mask', short: 'No mask', sub: '', pf: 1, pfLabel: '1×', filter: 0, style: 'none',
      note: 'Everything in the air reaches your nose and mouth.', price: '—', weight: '—' },
    { id: 'cloth', name: 'Cloth mask', short: 'Cloth mask', sub: 'No standard', pf: 1.5, pfLabel: '~1.5×', filter: .3, style: 'cloth',
      note: 'Air goes through the weave and round the sides. Fine as a cover, not as protection.', price: '~$6', weight: '~15 g' },
    { id: 'surgical', name: 'Surgical mask', short: 'Surgical mask', sub: 'EN 14683 · ASTM F2100', pf: 3, pfLabel: '~3×', filter: .08, style: 'surgical',
      note: 'Made to catch splashes and your own droplets, not to seal. Most of what you breathe in comes round the sides.', price: '~15¢ each', weight: '~3 g' },
    { id: 'ffp2ear', name: 'KN95 or FFP2 with ear loops', short: 'Ear-loop KN95', sub: 'Good filter, weak seal', pf: 5, pfLabel: '~5×', filter: .02, style: 'ffpear', tag: 'warn',
      note: 'The filter is as good as an N95’s, but ear loops rarely hold a seal. In fit tests about 4 in 100 pass, against about 80 in 100 for folded three-panel respirators with head straps.', price: '~70¢ each', weight: '~8 g' },
    { id: 'ffp2', name: 'N95 or FFP2 with head straps', short: 'N95 / FFP2', sub: 'Also sold as KN95, KF94, P2', pf: 10, pfLabel: '10×', filter: .02, style: 'ffp', tag: 'best', models: 'disposable',
      note: 'The everyday respirator for crowds, travel, smoke and viral illness. Sealed well, most people get far better than 10×.', price: '~$1 each', weight: '~10 g' },
    { id: 'ffp3', name: 'FFP3', short: 'FFP3', sub: 'Top EU and UK disposable class', pf: 20, pfLabel: '20×', filter: .005, style: 'ffp3',
      note: 'Used in high-risk healthcare. Many have an exhalation valve, which lets some of your breath out unfiltered.', price: '~$4 each', weight: '~15 g' },
    { id: 'half', name: 'Reusable half mask', short: 'Half mask', sub: 'Rubber or silicone, P100 or P3 filters', pf: 20, pfLabel: '20×', filter: .0005, style: 'half', models: 'reusable',
      note: 'Usually seals better than a disposable, and lasts for years. The cheapest high protection if you wear one often.', price: '~$40', weight: '~120 g' },
    { id: 'hood', name: 'Powered hood (PAPR)', short: 'Powered hood', sub: 'Battery fan, loose hood', pf: 25, pfLabel: '25×', filter: .0005, style: 'hood',
      note: 'A fan blows filtered air into the hood, so nothing needs to seal. Works with a beard.', price: '$1,500+', weight: '~600 g', carried: '+ 1.1 kg on a belt' },
    { id: 'full', name: 'Full-face mask', short: 'Full-face mask', sub: 'P100 or P3 filters', pf: 40, pfLabel: '40×', filter: .0005, style: 'full',
      note: 'A half mask with a visor that covers your eyes too. Bulky for everyday wear.', price: '~$200', weight: '~450 g' },
    { id: 'papr', name: 'Powered half mask', short: 'Powered half mask', sub: 'Battery fan, sealed half mask', pf: 40, pfLabel: '40×', filter: .0005, style: 'papr',
      note: 'A belt fan pushes filtered air into a sealed half mask, so breathing takes no effort. Rated level with a full-face mask.', price: '$1,500+', weight: '~150 g', carried: '+ 1.3 kg on a belt' },
  ];

  // ---- Particle scene: a face seen from the front, drawn in a 400 × 300 box and scaled to fit ----
  function createScene(cv) {
    const ctx = cv.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    let C = {}, mask = null, parts = [], scale = 1, ox = 0, oy = 0, last = 0, clock = 0, spawnAcc = 0;
    const readColors = () => {
      C = {}; ['face', 'face-2', 'accent', 'accent-soft', 'particle', 'caught', 'filter', 'edge', 'surface', 'line', 'rubber', 'ink-soft', 'cart', 'strap2', 'strap3']
        .forEach((k) => { C[k] = css('--' + k); });
    };

    const P = (d) => new Path2D(d);
    const F = {
      head: P('M200 22 C150 22 122 60 122 112 C122 150 128 186 142 214 C156 242 178 258 200 258 C222 258 244 242 258 214 C272 186 278 150 278 112 C278 60 250 22 200 22 Z'),
      hair: P('M200 22 C150 22 122 60 122 110 C138 76 168 62 200 62 C232 62 262 76 278 110 C278 60 250 22 200 22 Z'),
      neck: P('M168 236 L168 270 C130 278 92 288 66 300 L334 300 C308 288 270 278 232 270 L232 236 Z'),
    };
    const S = {
      flat: P('M142 150 C170 141 230 141 258 150 L262 222 C236 236 164 236 138 222 Z'),
      flat3: P('M200 132 C176 132 154 140 144 152 C140 176 142 200 150 220 C164 240 184 248 200 248 C216 248 236 240 250 220 C258 200 260 176 256 152 C246 140 224 132 200 132 Z'),
      cup: P('M200 127 C175 127 150 146 144 176 C139 207 166 245 200 249 C234 245 261 207 256 176 C250 146 225 127 200 127 Z'),
      half: P('M200 124 C186 124 172 148 160 176 C151 198 159 222 176 233 C187 239 213 239 224 233 C241 222 249 198 240 176 C228 148 214 124 200 124 Z'),
      full: P('M200 34 C150 34 126 70 126 118 C126 160 132 200 150 230 C164 252 182 262 200 262 C218 262 236 252 250 230 C268 200 274 160 274 118 C274 70 250 34 200 34 Z'),
      fullLens: P('M200 46 C158 46 138 76 138 118 C138 156 144 190 158 214 C170 234 184 242 200 242 C216 242 230 234 242 214 C256 190 262 156 262 118 C262 76 242 46 200 46 Z'),
      nosecup: P('M200 140 C180 140 165 160 163 184 C161 206 177 224 200 226 C223 224 239 206 237 184 C235 160 220 140 200 140 Z'),
      helmet: P('M108 120 C108 52 150 8 200 8 C250 8 292 52 292 120 Z'),
      shield: P('M120 118 L280 118 L272 234 C254 258 228 266 200 266 C172 266 146 258 128 234 Z'),
      seal: P('M128 234 C146 258 172 266 200 266 C228 266 254 258 272 234 L280 262 C258 290 230 298 200 298 C170 298 142 290 120 262 Z'),
    };
    // Where each mask meets the air (an ellipse), and the gaps where unfiltered air sneaks in.
    const BARRIER = {
      none: { cx: 200, cy: 182, rx: 24, ry: 28, gaps: [] },
      cloth: { cx: 200, cy: 188, rx: 66, ry: 50, gaps: [[142, 152], [258, 152], [140, 222], [260, 222], [176, 142], [224, 142]] },
      surgical: { cx: 200, cy: 188, rx: 66, ry: 50, gaps: [[142, 152], [258, 152], [140, 222], [260, 222], [176, 142], [224, 142]] },
      ffp: { cx: 200, cy: 188, rx: 60, ry: 63, gaps: [[176, 131], [224, 131], [146, 198], [254, 198], [200, 249]] },
      ffpear: { cx: 200, cy: 188, rx: 60, ry: 63, gaps: [[172, 132], [228, 132], [146, 170], [254, 170], [146, 212], [254, 212], [200, 249]] },
      ffp3: { cx: 200, cy: 188, rx: 60, ry: 63, gaps: [[176, 131], [224, 131], [146, 198], [254, 198], [200, 249]] },
      half: { cx: 200, cy: 194, rx: 82, ry: 50, gaps: [[186, 127], [214, 127], [168, 232], [232, 232]] },
      papr: { cx: 200, cy: 190, rx: 48, ry: 56, gaps: [[186, 127], [214, 127], [168, 232], [232, 232]] },
      full: { cx: 200, cy: 150, rx: 78, ry: 116, gaps: [[142, 70], [258, 70], [136, 200], [264, 200]] },
      hood: { cx: 200, cy: 160, rx: 84, ry: 110, gaps: [[134, 262], [266, 262]] },
    };
    const INHALE = { x: 200, y: 184 };
    const bar = () => BARRIER[mask ? mask.style : 'none'];
    const inside = (q, b) => ((q.x - b.cx) / b.rx) ** 2 + ((q.y - b.cy) / b.ry) ** 2 <= 1;

    function resize() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
      scale = Math.min(cv.width / 400, cv.height / 300);
      ox = (cv.width - 400 * scale) / 2; oy = (cv.height - 300 * scale) / 2;
    }

    // Particles drift in from the air in front of the face: they start small and faint and grow as they
    // reach the mask, so each one visibly lands somewhere. What happens next depends on its fate:
    // stop = caught on the mask surface, filter = passes through the material (or a filter cartridge),
    // edge = slips in at a gap round the edge, straight = no mask at all.
    const CARTRIDGES = { half: [[150, 202], [250, 202]], full: [[156, 240], [244, 240]], papr: [[200, 222]] };
    const surfacePoint = (b, side) => {
      const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * .72;
      return [b.cx + Math.cos(ang) * b.rx * rr * (side ? .9 : 1), b.cy + Math.sin(ang) * b.ry * rr * .85];
    };
    function assign(q) {
      const b = bar(), s = mask ? mask.style : 'none';
      if (s === 'none') {
        // no mask: aim at the nose or the mouth, spread out so they don't pile up on one point, and drift in slowly
        q.fate = 'straight';
        [q.tx, q.ty] = Math.random() < .45 ? [200 + (Math.random() - .5) * 18, 160 + (Math.random() - .5) * 8] : [200 + (Math.random() - .5) * 34, 200 + (Math.random() - .5) * 8];
        q.dur = 4 + Math.random() * 2.5; return;
      }
      const total = 1 / mask.pf, f = Math.min(total, mask.filter), u = Math.random(), carts = CARTRIDGES[s];
      if (u < f) { q.fate = 'filter'; [q.tx, q.ty] = carts ? carts[Math.floor(Math.random() * carts.length)].map((v) => v + (Math.random() - .5) * 14) : surfacePoint(b); }
      else if (u < total && b.gaps.length) { q.fate = 'edge'; [q.tx, q.ty] = b.gaps[Math.floor(Math.random() * b.gaps.length)]; }
      else { q.fate = 'stop'; [q.tx, q.ty] = carts && Math.random() < .6 ? carts[Math.floor(Math.random() * carts.length)].map((v) => v + (Math.random() - .5) * 30) : surfacePoint(b); }
    }
    function spawn(progress) {
      const q = { sx: Math.random() * 400, sy: 20 + Math.random() * 270, t: progress || 0, dur: 2.6 + Math.random() * 1.8,
        r: Math.random() < .18 ? 2.6 + Math.random() * 1.2 : 1.2 + Math.random() * 1.1, s: 'fly', a: 1, bend: (Math.random() - .5) * 60 };
      assign(q); q.x = q.sx; q.y = q.sy; parts.push(q);
    }
    const line = (pts, w, color, alpha = 1, curve) => {
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
      if (curve) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); else ctx.lineTo(pts[2], pts[3]);
      ctx.lineWidth = w; ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.stroke(); ctx.globalAlpha = 1;
    };
    const both = (fn) => { fn(1); ctx.save(); ctx.translate(400, 0); ctx.scale(-1, 1); fn(-1); ctx.restore(); };
    function cartridge(x, y, r) {
      ctx.fillStyle = C['cart']; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C['rubber']; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.strokeStyle = C['surface']; ctx.globalAlpha = .5; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r * .62, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = C['rubber']; ctx.beginPath(); ctx.arc(x, y, r * .2, 0, Math.PI * 2); ctx.fill();
    }
    function valve(x, y, r, fill) {
      ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C['rubber']; ctx.lineWidth = 2; ctx.stroke();
      ctx.lineWidth = 1.2; for (let k = -r * .5; k <= r * .5; k += r * .25) { ctx.beginPath(); ctx.moveTo(x - r * .55, y + k); ctx.lineTo(x + r * .55, y + k); ctx.stroke(); }
    }

    function drawFace() {
      ctx.fillStyle = C['face-2']; ctx.fill(F.neck);
      ctx.fillStyle = C['face']; ctx.fill(F.head);
      ctx.fillStyle = C['face-2']; ctx.fill(F.hair);
      [[120, 142], [280, 142]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 9, 20, 0, 0, Math.PI * 2); ctx.fillStyle = C['face']; ctx.fill(); });
      ctx.fillStyle = C['ink-soft']; ctx.globalAlpha = .55;
      [[172, 122], [228, 122]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 7, 3.4, 0, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
      line([160, 108, 172, 102, 184, 107], 1.6, C['ink-soft'], .35, true); line([216, 107, 228, 102, 240, 108], 1.6, C['ink-soft'], .35, true);
      line([198, 130, 192, 160, 200, 164], 1.4, C['ink-soft'], .35, true);
      line([186, 198, 200, 203, 214, 198], 1.6, C['ink-soft'], .4, true);
    }

    function drawMask() {
      if (!mask || mask.style === 'none') return;
      const s = mask.style;
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (s === 'cloth' || s === 'surgical') {
        // ear loops
        both(() => { line([142, 154, 126, 128, 120, 132], 1.6, C['ink-soft'], .55, true); line([140, 220, 124, 178, 120, 152], 1.6, C['ink-soft'], .55, true); });
        ctx.fillStyle = s === 'cloth' ? C['face-2'] : C['accent-soft']; ctx.fill(S.flat);
        if (s === 'cloth') {
          ctx.save(); ctx.clip(S.flat); ctx.strokeStyle = C['particle']; ctx.globalAlpha = .35; ctx.lineWidth = 1;
          for (let k = 80; k < 340; k += 7) { ctx.beginPath(); ctx.moveTo(k, 130); ctx.lineTo(k - 60, 240); ctx.stroke(); }
          ctx.restore();
        } else {
          [168, 186, 204].forEach((y) => line([140, y, 200, y + 3, 260, y], 1, C['accent'], .5, true));
          line([166, 147, 200, 142, 234, 147], 3, C['ink-soft'], .6, true);
        }
        ctx.strokeStyle = s === 'cloth' ? C['particle'] : C['accent']; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]); ctx.stroke(S.flat); ctx.setLineDash([]);
      } else if (s === 'ffp') {
        // FFP2 / N95: white moulded cup (3M 8810 / Aura style), blue head straps, nose clip, centre seam, sealed edge, no valve
        both(() => { line([148, 160, 134, 132, 124, 114], 2.4, C['strap2'], .9, true); line([152, 216, 138, 224, 128, 214], 2.4, C['strap2'], .9, true); });
        const g = ctx.createRadialGradient(194, 176, 8, 200, 190, 70);
        g.addColorStop(0, C['surface']); g.addColorStop(1, C['face-2']);
        ctx.fillStyle = g; ctx.fill(S.cup);
        ctx.strokeStyle = C['accent']; ctx.lineWidth = 3; ctx.stroke(S.cup);
        line([200, 134, 204, 190, 200, 244], 1, C['ink-soft'], .35, true);
        line([180, 135, 200, 129, 220, 135], 3.5, C['ink-soft'], .75, true);
      } else if (s === 'ffpear') {
        // FFP2 / KN95 with ear loops: the loops pull the edges away from the cheeks, leaving gaps
        both(() => { line([146, 158, 120, 126, 116, 140], 1.8, C['ink-soft'], .7, true); line([150, 214, 122, 196, 118, 150], 1.8, C['ink-soft'], .7, true); });
        ctx.fillStyle = C['surface']; ctx.fill(S.cup);
        ctx.strokeStyle = C['accent']; ctx.lineWidth = 2.4; ctx.stroke(S.cup);
        line([200, 134, 204, 190, 200, 244], 1, C['ink-soft'], .35, true);
        line([180, 135, 200, 129, 220, 135], 3, C['ink-soft'], .6, true);
        // gaps where the edge lifts off the face
        ctx.strokeStyle = C['edge']; ctx.lineWidth = 2.4; ctx.setLineDash([3, 4]);
        both(() => { ctx.beginPath(); ctx.moveTo(147, 158); ctx.quadraticCurveTo(140, 184, 148, 214); ctx.stroke(); ctx.beginPath(); ctx.moveTo(174, 132); ctx.quadraticCurveTo(160, 138, 152, 150); ctx.stroke(); });
        ctx.setLineDash([]);
      } else if (s === 'ffp3') {
        // FFP3: three-panel fold-flat respirator (3M Aura 9332 style), red head straps, wide nose foam, big front valve
        both(() => { line([146, 150, 132, 124, 124, 108], 3, C['strap3'], .95, true); line([148, 214, 136, 226, 128, 218], 3, C['strap3'], .95, true); });
        ctx.fillStyle = C['surface']; ctx.fill(S.flat3);
        ctx.strokeStyle = C['accent']; ctx.lineWidth = 3; ctx.stroke(S.flat3);
        ctx.fillStyle = C['face-2']; ctx.beginPath(); ctx.moveTo(150, 166); ctx.quadraticCurveTo(200, 180, 250, 166); ctx.lineTo(252, 168); ctx.quadraticCurveTo(200, 184, 148, 168); ctx.fill();
        line([148, 167, 200, 182, 252, 167], 1.4, C['ink-soft'], .45, true);
        line([150, 214, 200, 226, 250, 214], 1.4, C['ink-soft'], .45, true);
        ctx.fillStyle = C['face-2']; ctx.beginPath(); ctx.roundRect(168, 136, 64, 8, 4); ctx.fill();
        // exhalation valve
        ctx.fillStyle = C['rubber']; ctx.beginPath(); ctx.roundRect(182, 188, 36, 30, 9); ctx.fill();
        ctx.strokeStyle = C['face-2']; ctx.lineWidth = 1.6;
        for (let y = 194; y <= 212; y += 4.5) { ctx.beginPath(); ctx.moveTo(188, y); ctx.lineTo(212, y); ctx.stroke(); }
      } else if (s === 'half' || s === 'papr') {
        // reusable half mask (3M 6000 / 7500, JSP Force 8): crown cradle, nose cone, centre valve, two side cartridges
        ctx.beginPath(); ctx.moveTo(150, 46); ctx.quadraticCurveTo(200, 18, 250, 46); ctx.lineWidth = 8; ctx.strokeStyle = C['rubber']; ctx.globalAlpha = .8; ctx.stroke(); ctx.globalAlpha = 1;
        both(() => { line([168, 146, 146, 100, 150, 48], 3.5, C['rubber'], .8, true); line([150, 214, 132, 226, 124, 214], 3.5, C['rubber'], .8, true); });
        ctx.fillStyle = C['rubber']; ctx.fill(S.half);
        ctx.strokeStyle = C['accent']; ctx.lineWidth = 2; ctx.stroke(S.half);
        line([200, 132, 200, 150, 200, 186], 1, C['surface'], .3, true);
        if (s === 'half') {
          both(() => { ctx.fillStyle = C['rubber']; ctx.beginPath(); ctx.roundRect(160, 194, 18, 14, 4); ctx.fill(); cartridge(150, 202, 26); });
          valve(200, 210, 15, C['face-2']);
        } else {
          valve(200, 172, 11, C['face-2']);
          ctx.fillStyle = C['face-2']; ctx.beginPath(); ctx.arc(200, 222, 12, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(200, 232); ctx.bezierCurveTo(198, 260, 214, 280, 236, 300); ctx.lineWidth = 11; ctx.strokeStyle = C['rubber']; ctx.stroke();
          ctx.strokeStyle = C['face-2']; ctx.globalAlpha = .7; ctx.lineWidth = 1.2;
          for (let k = .06; k < 1; k += .09) { const u = 1 - k, x = u*u*u*200 + 3*u*u*k*198 + 3*u*k*k*214 + k*k*k*236, y = u*u*u*232 + 3*u*u*k*260 + 3*u*k*k*280 + k*k*k*300; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.stroke(); }
          ctx.globalAlpha = 1;
        }
      } else if (s === 'full') {
        // full-face mask (3M 6800, JSP Force 10): spider harness, rubber frame, clear visor, inner nose cup, chin valve, two cartridges
        [[128, 98, 200, -2, 272, 98], [134, 150, 200, 40, 266, 150]].forEach((pts) => line(pts, 4, C['rubber'], .8, true));
        both(() => line([130, 200, 120, 210, 118, 226], 4, C['rubber'], .8, true));
        ctx.fillStyle = C['rubber']; ctx.fill(S.full);
        ctx.save(); ctx.clip(S.fullLens); drawFace(); ctx.restore();
        ctx.fillStyle = C['accent-soft']; ctx.globalAlpha = .4; ctx.fill(S.fullLens); ctx.globalAlpha = 1;
        ctx.fillStyle = C['rubber']; ctx.globalAlpha = .45; ctx.fill(S.nosecup); ctx.globalAlpha = 1;
        ctx.strokeStyle = C['rubber']; ctx.lineWidth = 2; ctx.stroke(S.fullLens);
        line([160, 70, 146, 110, 150, 160], 3, C['surface'], .7, true);
        both(() => cartridge(156, 240, 19));
        valve(200, 250, 13, C['face-2']);
      } else if (s === 'hood') {
        // powered helmet (3M Versaflo): hard shell, brim, clear face shield, fabric face seal, hose to the belt fan
        ctx.beginPath(); ctx.moveTo(290, 150); ctx.bezierCurveTo(344, 180, 330, 250, 372, 300); ctx.lineWidth = 11; ctx.strokeStyle = C['rubber']; ctx.stroke();
        ctx.fillStyle = C['accent-soft']; ctx.fill(S.seal);
        ctx.fillStyle = C['accent-soft']; ctx.globalAlpha = .35; ctx.fill(S.shield); ctx.globalAlpha = 1;
        ctx.strokeStyle = C['accent']; ctx.lineWidth = 2; ctx.stroke(S.shield);
        line([140, 132, 132, 180, 140, 226], 3, C['surface'], .7, true);
        ctx.fillStyle = C['surface']; ctx.fill(S.helmet);
        ctx.strokeStyle = C['ink-soft']; ctx.globalAlpha = .55; ctx.lineWidth = 1.5; ctx.stroke(S.helmet); ctx.globalAlpha = 1;
        line([150, 40, 200, 26, 250, 40], 1.2, C['ink-soft'], .35, true);
        ctx.fillStyle = C['rubber']; ctx.beginPath(); ctx.roundRect(112, 110, 176, 12, 6); ctx.fill();
      }
      ctx.restore();
    }

    function moveTo(q, t, sp, dt) {
      const dx = t.x - q.x, dy = t.y - q.y, d = Math.hypot(dx, dy) || 1;
      q.x += dx / d * sp * dt; q.y += dy / d * sp * dt; return d;
    }

    function frame(now) {
      // SPEED slows the whole animation: particles, pauses, fades and the breathing rhythm
      const SPEED = .6;
      const dt = Math.min(.05, (now - last) / 1000 || 0) * SPEED; last = now; clock += dt;
      const breath = .55 + .75 * Math.max(0, Math.sin(clock * Math.PI / 2)); // inhale pulls particles in, in waves
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      drawFace();
      if (!reduce) { spawnAcc += dt * 24 * breath; while (spawnAcc > 1) { spawn(); spawnAcc--; } }
      const b = bar();
      if (!reduce) for (const q of parts) {
        if (q.s === 'fly') {
          q.t = Math.min(1, q.t + dt * breath / q.dur);
          const e = q.t * q.t * (3 - 2 * q.t), mx = (q.sx + q.tx) / 2 + q.bend, my = (q.sy + q.ty) / 2 - Math.abs(q.bend) * .4;
          q.x = (1 - e) * (1 - e) * q.sx + 2 * (1 - e) * e * mx + e * e * q.tx;
          q.y = (1 - e) * (1 - e) * q.sy + 2 * (1 - e) * e * my + e * e * q.ty;
          if (q.t >= 1) {
            q.s = q.fate === 'stop' ? 'stuck' : q.fate === 'filter' ? 'through' : 'leak'; q.ring = 0; q.trail = [];
            // red ones sit at the gap for a moment before slipping in; grey ones stay stuck to the mask for a while
            q.hold = q.s === 'leak' && q.fate === 'edge' ? 1.4 + Math.random() * .8 : q.s === 'stuck' ? 2.2 + Math.random() * 1.2 : 0;
            if (q.fate === 'straight') q.ring = 1;
          }
        } else if (q.s === 'stuck') { if (q.hold > 0) q.hold -= dt; else q.a -= dt * .5; }
        else if (q.hold > 0) {
          // lingering at the edge: a small jiggle in place, with the ripple repeating
          q.hold -= dt; q.ring = (q.ring + dt * 1.2) % 1;
          q.x = q.tx + Math.sin(clock * 9 + q.sx) * 1.2; q.y = q.ty + Math.cos(clock * 7 + q.sy) * 1.2;
        }
        else if (q.fate === 'straight') { q.a -= dt * .9; }
        else if (q.fate === 'edge') {
          // after lingering, it slips in under the edge: shrink and fade right at the gap, never crossing the mask
          q.a -= dt * 1.4; q.r = Math.max(.4, q.r - dt * 1.2); q.ring = Math.min(1, q.ring + dt * 1.6);
        }
        else {
          q.ring += dt * 1.6;
          const sp = q.s === 'through' ? 16 : 34;
          if (q.s === 'leak') { q.trail.push([q.x, q.y]); if (q.trail.length > 10) q.trail.shift(); }
          if (moveTo(q, INHALE, sp * breath + 6, dt) < 4) q.a -= dt * 2.5;
        }
      }
      drawMask();
      // faint red glow at the gaps where this mask leaks
      if (mask && mask.style !== 'none' && b.gaps.length && 1 / mask.pf - mask.filter > .005) {
        ctx.save();
        b.gaps.forEach(([x, y]) => {
          const g = ctx.createRadialGradient(x, y, 0, x, y, 11);
          g.addColorStop(0, C['edge']); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = .28 + .12 * Math.sin(clock * 3); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
      }
      for (const q of parts) {
        const a = Math.max(0, Math.min(1, q.a));
        if (q.s === 'fly') {
          const e = q.t; ctx.globalAlpha = .45 + .55 * e; ctx.fillStyle = q.fate === 'straight' && e > .75 ? C['edge'] : C['particle'];
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (.5 + .5 * e), 0, Math.PI * 2); ctx.fill(); continue;
        }
        const col = q.s === 'stuck' ? C['caught'] : q.s === 'through' ? C['filter'] : C['edge'];
        if (q.s !== 'stuck' && q.ring < 1) {
          ctx.globalAlpha = (1 - q.ring) * .9; ctx.strokeStyle = col; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.arc(q.tx, q.ty, 2 + q.ring * 10, 0, Math.PI * 2); ctx.stroke();
        }
        if (q.s === 'leak' && q.trail.length > 1) {
          ctx.globalAlpha = a * .5; ctx.strokeStyle = col; ctx.lineWidth = q.r * .9; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(q.trail[0][0], q.trail[0][1]); q.trail.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.stroke();
        }
        ctx.globalAlpha = a; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.s === 'stuck' ? q.r + .4 : q.r + (q.hold > 0 ? 1.2 : .6), 0, Math.PI * 2); ctx.fill();
        if (q.s === 'stuck' && q.hold > 0) { ctx.globalAlpha = a * .5; ctx.strokeStyle = C['caught']; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(q.x, q.y, q.r + 1.8, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      parts = parts.filter((q) => q.a > 0);
      if (!reduce) requestAnimationFrame(frame);
    }

    function still() {
      // Reduced motion: one settled frame showing where particles ended up.
      parts = [];
      for (let i = 0; i < 90; i++) {
        const q = { sx: Math.random() * 400, sy: 20 + Math.random() * 270, t: 1, r: 1.2 + Math.random() * 1.6, a: 1, ring: 1, trail: [] };
        assign(q);
        if (Math.random() < .35) { Object.assign(q, { s: 'fly', t: .3 + Math.random() * .5, x: q.sx, y: q.sy }); }
        else {
          q.s = q.fate === 'stop' ? 'stuck' : q.fate === 'filter' ? 'through' : 'leak';
          const k = q.s === 'stuck' ? 0 : .3 + Math.random() * .5;
          q.x = q.tx + (INHALE.x - q.tx) * k; q.y = q.ty + (INHALE.y - q.ty) * k;
        }
        parts.push(q);
      }
      frame(performance.now());
    }

    readColors(); resize();
    new ResizeObserver(() => { resize(); if (reduce && mask) still(); }).observe(cv);
    const recolor = () => { readColors(); if (reduce && mask) still(); };
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);
    new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    let started = false;
    return {
      setMask(m) {
        mask = m;
        // particles still in the air take on the new mask's odds; ones already on the old mask fade out
        parts.forEach((q) => { if (q.s === 'fly') assign(q); else q.a = Math.min(q.a, .5); });
        if (reduce) { still(); return; }
        if (!started) { started = true; for (let i = 0; i < 60; i++) spawn(Math.random() * .9); last = performance.now(); requestAnimationFrame(frame); }
      },
    };
  }


  // Specific models to look for. `where` names the site the link goes to.
  const MODELS = {
    disposable: [
      { name: '3M Aura 9205+', tag: 'N95 · three-panel fold-flat · no valve', url: 'https://www.3m.com/3M/en_US/p/d/b00051022/', where: '3M' },
      { name: '3M 8210', tag: 'N95 · moulded cup · no valve', url: 'https://www.3m.com/3M/en_US/p/dc/v000585997/', where: '3M' },
      { name: 'Honeywell DF300', tag: 'N95 · flat-fold', url: 'https://gemplers.com/products/honeywell-df300-flat-fold-n95-respirators', where: 'Gempler’s' },
      { name: 'Powecom KN95, headband version', tag: 'KN95 · also sold with ear loops', url: 'https://bonafidemasks.com/kn95-respirator-mask-headband-style-fda-authorized/', where: 'Bona Fide Masks' },
    ],
    reusable: [
      { name: '3M 6200', tag: 'Half mask · 6000 series · P100 filters', url: 'https://www.3m.com/3M/en_US/p/dc/v101806317/', where: '3M' },
      { name: 'Dentec Comfort-Air 400', tag: 'Half mask · P100 filters', url: 'https://www.fishersci.com/shop/products/diskit-p100-elastomeric-respirator-2/19222466', where: 'Fisher Scientific' },
      { name: 'GVS Elipse P100', tag: 'Low-profile half mask', url: 'https://www.rockler.com/gvs-elipse-p100-half-mask-respirators', where: 'Rockler' },
      { name: 'MSA Advantage 900', tag: 'Half mask · no exhalation valve', url: 'https://us.msasafety.com/p/000100000200001190?locale=en', where: 'MSA' },
      { name: 'EnvoPro (Envomask)', tag: 'Half mask · N95 or N99 filters', url: 'https://envomask.com/', where: 'Envomask' },
    ],
  };

  return { MASKS, MODELS, createScene };
})();
