/* KROMMA TECH — roda 3D procedural (WebGL puro, sem bibliotecas nem arquivos externos).
   Tudo é gerado em código: pneu com banda de rodagem e relevo, aro com friso vermelho, 10 raios chanfrados, cubo com 5 porcas,
   disco de freio furado e pinça vermelha (parada em relação ao giro). Iluminação PBR simplificada com um "estúdio" procedural
   (softboxes branca/fria e faixa vermelha) refletido nos metais e na borracha.
   Motion blur REAL: cada quadro é a média de vários sub-quadros ao longo do obturador (posição + rotação), com jitter sub-pixel (antialias).
   API: KrommaWheel.create(canvas, W, H, ratio, Rref) → { render(poses, stepPx), clear(), resize, dispose } ou null (sem WebGL). */
(() => {
  'use strict';

  /* ---------- matrizes 4x4 (column-major) ---------- */
  const M = {
    id() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
    mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
    persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
    trans(x, y, z) { const o = M.id(); o[12] = x; o[13] = y; o[14] = z; return o; },
    scale(s) { const o = M.id(); o[0] = o[5] = o[10] = s; return o; },
    rotX(a) { const c = Math.cos(a), s = Math.sin(a), o = M.id(); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
    rotY(a) { const c = Math.cos(a), s = Math.sin(a), o = M.id(); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
    rotZ(a) { const c = Math.cos(a), s = Math.sin(a), o = M.id(); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; }
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  /* ---------- construtor de malha ---------- */
  class B {
    constructor() { this.d = []; this.i = []; this.n = 0; }
    v(p, n, m) { this.d.push(p[0], p[1], p[2], n[0], n[1], n[2], m); return this.n++; }
    quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
    tri(a, b, c) { this.i.push(a, b, c); }
    flatQuad(p0, p1, p2, p3, m, ref) {           // face plana; normal orientada para longe de "ref"
      let n = nrm(cross(sub(p1, p0), sub(p3, p0)));
      const c = [(p0[0] + p1[0] + p2[0] + p3[0]) / 4, (p0[1] + p1[1] + p2[1] + p3[1]) / 4, (p0[2] + p1[2] + p2[2] + p3[2]) / 4];
      if (dot(n, sub(c, ref)) < 0) n = [-n[0], -n[1], -n[2]];
      const a = this.v(p0, n, m), b = this.v(p1, n, m), cc = this.v(p2, n, m), d = this.v(p3, n, m);
      this.quad(a, b, cc, d);
    }
  }

  /* superfície de revolução em torno de Z. prof: [{r,z,m,hard}]; o material de cada segmento é o do ponto de partida.
     Normais suaves entre segmentos, salvo "hard". ang: [a0,a1]; tp(φ): fator de afunilamento (pinça). */
  function lathe(b, prof, segs, o = {}) {
    const a0 = o.a0 || 0, a1 = o.a1 === undefined ? Math.PI * 2 : o.a1, closed = o.closed;
    const nS = closed ? prof.length : prof.length - 1;
    const P = i => prof[i % prof.length];
    const sn = [];
    for (let i = 0; i < nS; i++) {
      const p = P(i), q = P(i + 1), dr = q.r - p.r, dz = q.z - p.z, l = Math.hypot(dr, dz) || 1;
      sn.push([dz / l, -dr / l]);
    }
    const avg = (u, v) => { const x = u[0] + v[0], y = u[1] + v[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
    let prevB = -1, prevM = -1;                    // reaproveita a linha final do segmento anterior quando a normal é suave e o material é o mesmo
    const mkRow = (pt, nn, m) => {
      const base = b.n;
      for (let k = 0; k <= segs; k++) {
        const ph = a0 + (a1 - a0) * k / segs, c = Math.cos(ph), s = Math.sin(ph);
        let r = pt.r, z = pt.z;
        if (o.taper) { const t = o.taper.fn(ph); r = o.taper.rc + (r - o.taper.rc) * t; z = o.taper.zc + (z - o.taper.zc) * t; }
        b.v([r * c, r * s, z], [nn[0] * c, nn[0] * s, nn[1]], m);
      }
      return base;
    };
    for (let i = 0; i < nS; i++) {
      const p = P(i), q = P(i + 1), m = p.m;
      const prev = closed ? sn[(i + nS - 1) % nS] : (i > 0 ? sn[i - 1] : null), next = closed ? sn[(i + 1) % nS] : (i < nS - 1 ? sn[i + 1] : null);
      const nA = (p.hard || !prev) ? sn[i] : avg(prev, sn[i]);
      const nB = (q.hard || !next) ? sn[i] : avg(sn[i], next);
      const A = (prevB >= 0 && !p.hard && prevM === m) ? prevB : mkRow(p, nA, m), Bb = mkRow(q, nB, m);
      for (let k = 0; k < segs; k++) b.quad(A + k, Bb + k, Bb + k + 1, A + k + 1);
      prevB = Bb; prevM = m;
    }
  }

  const catmull = (p0, p1, p2, p3, t) => {
    const t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
  };

  /* ---------- geometrias ---------- */
  function buildTire() {
    const b = new B();
    // meia seção (z>0) do talão ao ombro: [r, z]
    const ctl = [[.715, .262], [.742, .296], [.79, .340], [.84, .362], [.9, .358], [.95, .338], [.985, .302], [.998, .262], [1, .215]];
    const side = [];
    for (let i = 0; i < ctl.length - 1; i++) {
      const p0 = ctl[Math.max(0, i - 1)], p1 = ctl[i], p2 = ctl[i + 1], p3 = ctl[Math.min(ctl.length - 1, i + 2)];
      for (let k = 0; k < 4; k++) side.push(catmull(p0, p1, p2, p3, k / 4));
    }
    side.push(ctl[ctl.length - 1]);
    const groove = z => { const a = Math.abs(z); return .013 * (Math.exp(-Math.pow(a / .016, 2)) + Math.exp(-Math.pow((a - .105) / .014, 2)) + .7 * Math.exp(-Math.pow((a - .185) / .012, 2))); };
    const tread = [];
    for (let i = 1; i < 56; i++) { const z = -.215 + .43 * i / 56; tread.push([1 - groove(z), z]); }
    const prof = [];
    for (let i = side.length - 1; i >= 0; i--) prof.push({ r: side[i][0], z: -side[i][1], m: side[i][0] > .985 ? 1 : 0 });
    tread.forEach(([r, z]) => prof.push({ r, z, m: 1 }));
    side.forEach(([r, z]) => prof.push({ r, z, m: r > .985 ? 1 : 0 }));
    lathe(b, prof, 300);
    return b;
  }

  function buildRim() {
    const b = new B();
    const P = (r, z, m, hard) => ({ r, z, m, hard });
    lathe(b, [
      P(.70, .20, 2), P(.735, .272, 2), P(.752, .298, 2), P(.756, .318, 2), P(.748, .332, 2), P(.73, .338, 2),
      P(.712, .334, 3, true), P(.70, .322, 3), P(.69, .311, 2, true), P(.664, .285, 2), P(.645, .25, 2),
      P(.635, .232, 5, true), P(.635, -.25, 5)
    ], 220);
    return b;
  }

  function buildHub() {
    const b = new B(), P = (r, z, m, hard) => ({ r, z, m, hard });
    lathe(b, [
      P(0, .192, 5), P(.07, .190, 5), P(.07, .190, 3, true), P(.092, .186, 3), P(.092, .186, 4, true), P(.23, .160, 4),
      P(.236, .14, 5, true), P(.236, .02, 5)
    ], 96);
    // 5 porcas sextavadas cromadas
    for (let j = 0; j < 5; j++) {
      const ang = Math.PI / 2 + j * Math.PI * 2 / 5, cx = .135 * Math.cos(ang), cy = .135 * Math.sin(ang);
      const ring = (r, z) => { const a = []; for (let k = 0; k < 6; k++) { const t = ang + k * Math.PI / 3; a.push([cx + r * Math.cos(t), cy + r * Math.sin(t), z]); } return a; };
      const r0 = ring(.03, .168), r1 = ring(.03, .198), r2 = ring(.0235, .208), ctr = [cx, cy, .205];
      for (let k = 0; k < 6; k++) {
        const k2 = (k + 1) % 6;
        b.flatQuad(r0[k], r0[k2], r1[k2], r1[k], 8, [cx, cy, .185]);
        b.flatQuad(r1[k], r1[k2], r2[k2], r2[k], 8, [cx, cy, .19]);
        b.flatQuad(r2[k], r2[k2], [cx, cy, .208], [cx, cy, .208], 8, [cx, cy, .19]);
      }
    }
    return b;
  }

  function buildSpokes() {
    const b = new B(), S = 26;
    const face = (w, t) => {
      const c = .011, rw = w * .09;
      return [[-w / 2, -t / 2 + c, 4], [-w / 2, t / 2 - c, 4], [-w / 2 + c, t / 2, 4], [-rw, t / 2, 3], [rw, t / 2, 4],
        [w / 2 - c, t / 2, 4], [w / 2, t / 2 - c, 4], [w / 2, -t / 2 + c, 4], [w / 2 - c, -t / 2, 4], [-w / 2 + c, -t / 2, 4]];
    };
    for (let j = 0; j < 5; j++) for (const sd of [-1, 1]) {
      const th0 = Math.PI / 2 + j * Math.PI * 2 / 5;
      const path = [];
      for (let i = 0; i <= S; i++) {
        const s = i / S, r = .19 + .48 * s, z = .15 + .083 * Math.pow(s, 1.6), th = th0 + sd * (.02 + .19 * Math.pow(s, 1.1));
        path.push({ p: [r * Math.cos(th), r * Math.sin(th), z], w: .056 + .036 * Math.pow(s, 1.5), t: .066 - .02 * s });
      }
      const secs = path.map((q, i) => {
        const T = nrm(sub(path[Math.min(S, i + 1)].p, path[Math.max(0, i - 1)].p));
        const A = nrm(sub([0, 0, 1], [T[0] * T[2], T[1] * T[2], T[2] * T[2]])), Bv = nrm(cross(T, A));
        return face(q.w, q.t).map(([bb, aa, m]) => ({ p: [q.p[0] + Bv[0] * bb + A[0] * aa, q.p[1] + Bv[1] * bb + A[1] * aa, q.p[2] + Bv[2] * bb + A[2] * aa], m }));
      });
      for (let i = 0; i < S; i++) for (let f = 0; f < 10; f++) {
        const f2 = (f + 1) % 10, a = secs[i][f], c = secs[i][f2], d = secs[i + 1][f2], e = secs[i + 1][f];
        b.flatQuad(a.p, c.p, d.p, e.p, a.m, path[i].p);
      }
    }
    return b;
  }

  function buildDisc() {
    const b = new B(), P = (r, z, m, hard) => ({ r, z, m, hard });
    lathe(b, [P(.25, 0, 6, true), P(.585, 0, 6, true), P(.585, .034, 6, true), P(.25, .034, 5, true), P(.25, .12, 5, true), P(0, .12, 5)], 160);
    return b;
  }

  function buildCaliper() {
    const b = new B(), P = (r, z, hard = true) => ({ r, z, m: 7, hard });
    const half = .36;
    lathe(b, [P(.432, -.07), P(.588, -.07), P(.618, -.04), P(.618, .06), P(.588, .09), P(.432, .09), P(.402, .06), P(.402, -.04)], 36,
      { closed: true, a0: -half, a1: half, taper: { rc: .51, zc: .01, fn: ph => Math.max(.14, Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(ph) / half, 4)))) } });
    return b;
  }

  /* ---------- shaders ---------- */
  const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute float aMat;
uniform mat4 uMVP; uniform mat4 uModel; uniform vec2 uJit;
varying vec3 vL; varying vec3 vW; varying vec3 vN; varying float vM;
void main(){
  vL=aPos; vW=(uModel*vec4(aPos,1.)).xyz; vN=(uModel*vec4(aNor,0.)).xyz; vM=aMat;
  vec4 p=uMVP*vec4(aPos,1.); p.xy+=uJit*p.w; gl_Position=p;
}`;
  const FS = `
precision highp float;
varying vec3 vL; varying vec3 vW; varying vec3 vN; varying float vM;
uniform vec3 uCam; uniform float uEnvRot;
const float PI=3.14159265;
float hash(float n){ return fract(sin(n*12.9898)*43758.5453); }
float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }

float box(vec3 d, vec3 c, vec3 up, vec2 ext, float soft){
  float k=dot(d,c); if(k<=0.02) return 0.;
  vec3 u=normalize(cross(up,c)); vec3 v=cross(c,u);
  vec2 p=vec2(dot(d,u),dot(d,v))/k;
  vec2 m=1.-smoothstep(-soft,soft,abs(p)-ext);
  return m.x*m.y*smoothstep(.02,.25,k);
}
vec3 env(vec3 d0, float rough){
  float cs=cos(uEnvRot), sn=sin(uEnvRot);
  vec3 d=vec3(cs*d0.x+sn*d0.z, d0.y, -sn*d0.x+cs*d0.z);
  float s=.05+rough*.75, at=1./(1.+rough*2.2);
  vec3 col=mix(vec3(.012,.012,.016),vec3(.075,.08,.095),smoothstep(-.6,.9,d.y));
  col+=vec3(.9,.92,1.)*5.5*box(d,normalize(vec3(0.,1.,.2)),vec3(0.,0.,-1.),vec2(1.6,.8),s)*at;
  col+=vec3(1.,.97,.93)*3.4*box(d,normalize(vec3(-1.,.15,.45)),vec3(0.,1.,0.),vec2(.45,1.5),s)*at;
  col+=vec3(1.,.07,.03)*1.9*box(d,normalize(vec3(1.,0.,-.25)),vec3(0.,1.,0.),vec2(.18,1.2),s)*at;
  col+=vec3(.75,.85,1.)*3.*box(d,normalize(vec3(.2,.25,-1.)),vec3(0.,1.,0.),vec2(1.4,.22),s)*at;
  col+=vec3(1.,.08,.04)*.8*box(d,normalize(vec3(-.5,-.8,.35)),vec3(0.,0.,1.),vec2(1.,.5),s)*at;
  col+=vec3(.9,.9,.95)*1.1*box(d,normalize(vec3(.15,-.05,1.)),vec3(0.,1.,0.),vec2(1.2,.35),s)*at;
  return col;
}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }

void main(){
  vec3 N=normalize(vN), V=normalize(uCam-vW);
  if(dot(N,V)<0.) N=-N;
  int m=int(floor(vM+.5));
  float r=length(vL.xy), ang=atan(vL.y,vL.x);
  vec3 alb=vec3(.03), F0=vec3(.04); float rough=.8, ao=1., metal=0.;

  if(m==0){                                  // flanco do pneu
    alb=vec3(.011); rough=.7; F0=vec3(.03);
    float fib=hash(floor(ang*500.)); alb*=.9+.2*fib;
    ao=mix(.35,1.,smoothstep(.73,.84,r));
    alb=mix(alb,vec3(.03),smoothstep(.0035,.0,abs(r-.775)-.003));          // nervura do protetor de aro
    float band=step(.885,r)*step(r,.93);                                    // "lettering" vermelho
    float u=ang*34., cell=floor(u);
    float win=step(-2.75,ang)*step(ang,-.55)+step(.7,ang)*step(ang,1.75);
    float glyph=step(.18,fract(u))*step(fract(u),.82)*step(.55,hash2(vec2(cell,floor((r-.885)/.045*4.))));
    float red=band*win*glyph;
    float dash=step(.944,r)*step(r,.951)*step(.3,fract(ang*36.));           // fio vermelho tracejado
    red=max(red,dash);
    alb=mix(alb,vec3(.42,.018,.01),red); rough=mix(rough,.45,red);
  } else if(m==1){                           // banda de rodagem
    alb=vec3(.012); rough=.88; F0=vec3(.025);
    float ph=fract(ang/(2.*PI)*64.+abs(vL.z)*3.4);
    float d=min(ph,1.-ph);
    float slot=1.-smoothstep(.04,.085,d);
    alb*=mix(1.,.3,slot); ao=mix(1.,.3,slot);
    alb*=.9+.2*hash2(floor(vec2(ang*900.,vL.z*300.)));
  } else if(m==2){                           // aro polido
    alb=vec3(0.); F0=vec3(.9,.9,.93); rough=.13; metal=1.;
    ao=mix(.55,1.,smoothstep(.2,.33,vL.z));
  } else if(m==3){                           // esmalte vermelho
    alb=vec3(.85,.018,.012); F0=vec3(.05); rough=.12;
  } else if(m==4){                           // raios / cubo (metal acetinado)
    alb=vec3(0.); F0=vec3(.82,.82,.86); rough=.24; metal=1.;
    ao=mix(.7,1.,smoothstep(.1,.24,vL.z));
  } else if(m==5){                           // anodizado preto (interior do aro)
    alb=vec3(.022); F0=vec3(.06); rough=.42;
    ao=mix(.12,1.,smoothstep(-.25,.24,vL.z));
  } else if(m==6){                           // disco de freio
    if(r>.28&&r<.57){
      for(int k=0;k<2;k++){
        float rr=k==0?.355:.47, n=k==0?20.:26.;
        float a=ang/(2.*PI)*n+(k==0?0.:.5);
        float ac=fract(a)-.5;
        vec2 q=vec2(r-rr,ac*rr*2.*PI/n);
        if(length(q)<.024) discard;
      }
    }
    alb=vec3(0.); F0=vec3(.22,.22,.25); rough=.48; metal=1.;
    ao=.4*(.75+.25*smoothstep(.25,.58,r));
    F0*=.85+.3*hash(floor(r*180.));
  } else if(m==7){                           // pinça vermelha (verniz)
    alb=vec3(.9,.012,.01); F0=vec3(.05); rough=.14; ao=.82;
  } else {                                   // porcas cromadas
    alb=vec3(0.); F0=vec3(.92); rough=.1; metal=1.;
  }

  rough=max(rough,.06);
  float ndv=max(dot(N,V),0.);
  vec3 R=reflect(-V,N);
  vec3 Fe=F0+(max(vec3(1.-rough),F0)-F0)*pow(1.-ndv,5.);
  vec3 col=alb*env(N,1.)*.55*ao;
  vec3 specEnv=env(R,rough)*Fe*mix(1.,ao,.65)*(m<=1?.4:1.);

  // luzes diretas: principal (topo/esq.), recorte vermelho (dir./atrás), preenchimento frontal
  vec3 Ls[3]; vec3 Cs[3];
  Ls[0]=normalize(vec3(-.4,.8,.6)); Cs[0]=vec3(3.,2.9,2.8);
  Ls[1]=normalize(vec3(.9,.2,-.1)); Cs[1]=vec3(1.5,.1,.05);
  Ls[2]=normalize(vec3(.3,-.3,.9)); Cs[2]=vec3(.32,.33,.37);
  float a=rough*rough, a2=a*a, dsp=0.;
  vec3 spec=vec3(0.);
  for(int i=0;i<3;i++){
    vec3 L=Ls[i]; float nl=max(dot(N,L),0.);
    col+=alb*Cs[i]*nl*ao;
    vec3 H=normalize(L+V); float nh=max(dot(N,H),0.), vh=max(dot(V,H),0.);
    float dd=nh*nh*(a2-1.)+1.; float D=a2/(PI*dd*dd);
    vec3 Fh=F0+(1.-F0)*pow(1.-vh,5.);
    spec+=min(D,60.)*Fh*Cs[i]*nl*.25;
  }
  col+=specEnv+spec*ao;
  col+=vec3(.5,.55,.65)*pow(1.-ndv,3.)*.035*(1.-metal)*(m<=1?1.:0.);     // brilho de borracha em ângulo rasante
  col=aces(col*1.05);
  gl_FragColor=vec4(pow(col,vec3(1./2.2)),1.);
}`;
  const VQ = `attribute vec2 aP; varying vec2 vUv; void main(){ vUv=aP*.5+.5; gl_Position=vec4(aP,0.,1.); }`;
  const FCopy = `precision mediump float; varying vec2 vUv; uniform sampler2D uT; void main(){ gl_FragColor=texture2D(uT,vUv); }`;
  const FFinal = `
precision highp float; varying vec2 vUv; uniform sampler2D uT; uniform vec2 uTex; uniform float uStep;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec4 c=vec4(0.);
  for(int k=-4;k<=4;k++) c+=texture2D(uT,vUv+vec2(float(k)*.125*uStep*uTex.x,0.));
  c/=9.;
  vec3 g=vec3(0.);                                    // estria anamórfica nos brilhos
  for(int k=1;k<=4;k++){
    float o=float(k)*(10.+uStep*.8)*uTex.x, w=.5/float(k);
    vec3 a=texture2D(uT,vUv+vec2(o,0.)).rgb, b=texture2D(uT,vUv-vec2(o,0.)).rgb;
    g+=(max(a-.75,0.)+max(b-.75,0.))*w;
  }
  c.rgb+=g*.16*vec3(1.,.8,.78);
  c.a=min(1.,max(c.a,max(g.r,max(g.g,g.b))*.16));
  c.rgb+=(h(gl_FragCoord.xy)-.5)/255.*c.a;
  gl_FragColor=c;
}`;

  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

  function create(canvas, W, H, ratio, Rref) {
    let gl;
    try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) return null;
    try {
      const Wd = Math.max(2, Math.round(W * ratio)), Hd = Math.max(2, Math.round(H * ratio));
      canvas.width = Wd; canvas.height = Hd;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
      const U = (p, names) => { const o = {}; names.forEach(n => o[n] = gl.getUniformLocation(p, n)); return o; };
      const pm = prog(VS, FS), pc = prog(VQ, FCopy), pf = prog(VQ, FFinal);
      const um = U(pm, ['uMVP', 'uModel', 'uJit', 'uCam', 'uEnvRot']), uc = U(pc, ['uT']), uf = U(pf, ['uT', 'uTex', 'uStep']);
      const aPos = gl.getAttribLocation(pm, 'aPos'), aNor = gl.getAttribLocation(pm, 'aNor'), aMat = gl.getAttribLocation(pm, 'aMat'), aQ = gl.getAttribLocation(pc, 'aP'), aQf = gl.getAttribLocation(pf, 'aP');

      const mk = (b, spin) => {
        if (b.n > 65535) throw new Error('malha grande demais');
        const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.d), gl.STATIC_DRAW);
        const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(b.i), gl.STATIC_DRAW);
        return { vb, ib, n: b.i.length, spin };
      };
      const meshes = [mk(buildTire(), true), mk(buildRim(), true), mk(buildHub(), true), mk(buildSpokes(), true), mk(buildDisc(), true), mk(buildCaliper(), false)];

      const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

      const fbo = (depth) => {
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, Wd, Hd, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        if (depth) { const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, Wd, Hd); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); }
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incompleto');
        return { fb, tex };
      };
      const fS = fbo(true), fA = fbo(false);

      /* câmera: objetivo longo (FOV 24°); a roda de raio Rref px, em z=0, ocupa exatamente Rref px */
      const FOV = 24 * Math.PI / 180, dist = H / (2 * Rref * Math.tan(FOV / 2));
      const proj = M.persp(FOV, W / H, dist * .35, dist * 2.4), view = M.trans(0, 0, -dist);
      const VP = M.mul(proj, view);
      const CAL = 55 * Math.PI / 180;     // posição (fixa) da pinça
      let frameNo = 0;

      const quadDraw = a => { gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };

      function clear() { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, Wd, Hd); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }

      function drawScene(p, jx, jy) {
        const s = p.R / Rref, wx = (p.px - W / 2) / Rref, wy = (H / 2 - p.py) / Rref;
        const base = M.mul(M.trans(wx, wy, 0), M.mul(M.rotX(p.pitch), M.mul(M.rotY(p.yaw), M.scale(s))));
        const mSpin = M.mul(base, M.rotZ(-p.spin)), mStat = M.mul(base, M.rotZ(CAL));
        gl.uniform2f(um.uJit, jx * 2 / Wd, jy * 2 / Hd);
        gl.uniform3f(um.uCam, 0, 0, dist);
        gl.uniform1f(um.uEnvRot, p.envRot || 0);
        for (const me of meshes) {
          const model = me.spin ? mSpin : mStat;
          gl.uniformMatrix4fv(um.uModel, false, model);
          gl.uniformMatrix4fv(um.uMVP, false, M.mul(VP, model));
          gl.bindBuffer(gl.ARRAY_BUFFER, me.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, me.ib);
          gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
          gl.enableVertexAttribArray(aNor); gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 28, 12);
          gl.enableVertexAttribArray(aMat); gl.vertexAttribPointer(aMat, 1, gl.FLOAT, false, 28, 24);
          gl.drawElements(gl.TRIANGLES, me.n, gl.UNSIGNED_SHORT, 0);
        }
      }

      /* poses: sub-quadros ao longo do obturador. stepPx: passo (px CSS) entre sub-quadros, usado no borrão final */
      function render(poses, stepPx) {
        frameNo++;
        const N = poses.length;
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        poses.forEach(p => { const e = p.R * 1.5; x0 = Math.min(x0, p.px - e); x1 = Math.max(x1, p.px + e); y0 = Math.min(y0, p.py - e); y1 = Math.max(y1, p.py + e); });
        x0 = Math.max(0, Math.floor(x0 * ratio)); x1 = Math.min(Wd, Math.ceil(x1 * ratio)); y0 = Math.max(0, Math.floor(y0 * ratio)); y1 = Math.min(Hd, Math.ceil(y1 * ratio));
        if (x1 <= x0 || y1 <= y0) { clear(); return; }
        gl.viewport(0, 0, Wd, Hd);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fA.fb); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, Hd - y1, x1 - x0, y1 - y0);
        for (let k = 0; k < N; k++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fS.fb); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
          gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.useProgram(pm);
          const idx = frameNo * N + k + 1;
          drawScene(poses[k], halton(idx, 2) - .5, halton(idx, 3) - .5);
          gl.bindFramebuffer(gl.FRAMEBUFFER, fA.fb); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
          const w = 1 / (k + 1); gl.blendColor(w, w, w, w); gl.blendFunc(gl.CONSTANT_COLOR, gl.ONE_MINUS_CONSTANT_COLOR);
          gl.useProgram(pc); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fS.tex); gl.uniform1i(uc.uT, 0);
          quadDraw(aQ);
        }
        gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(pf); gl.bindTexture(gl.TEXTURE_2D, fA.tex); gl.uniform1i(uf.uT, 0);
        gl.uniform2f(uf.uTex, 1 / Wd, 1 / Hd); gl.uniform1f(uf.uStep, Math.max(0, (stepPx || 0) * ratio));
        quadDraw(aQf);
      }
      return { render, clear, lost: () => gl.isContextLost() };
    } catch (e) {
      try { console.warn('[kromma] roda 3D indisponível:', e && e.message); } catch (_) {}
      return null;
    }
  }

  window.KrommaWheel = { create };
})();
