"use strict";(self.webpackChunkquinielamx=self.webpackChunkquinielamx||[]).push([[2113],{2113:(x,h,p)=>{p.r(h),p.d(h,{startTapClick:()=>b});var o=p(8476),u=p(5638);const b=s=>{if(void 0===o.d)return;let e,E,a,i=10*-v,r=0;const O=s.getBoolean("animated",!0)&&s.getBoolean("rippleEffect",!0),l=new WeakMap,L=t=>{i=(0,u.u)(t),R(t)},A=()=>{a&&clearTimeout(a),a=void 0,e&&(I(!1),e=void 0)},D=t=>{e||w(g(t),t)},R=t=>{w(void 0,t)},w=(t,n)=>{if(t&&t===e)return;a&&clearTimeout(a),a=void 0;const{x:d,y:c}=(0,u.v)(n);if(e){if(l.has(e))throw new Error("internal error");e.classList.contains(f)||C(e,d,c),I(!0)}if(t){const M=l.get(t);M&&(clearTimeout(M),l.delete(t)),t.classList.remove(f);const S=()=>{C(t,d,c),a=void 0};m(t)?S():a=setTimeout(S,k)}e=t},C=(t,n,d)=>{if(r=Date.now(),t.classList.add(f),!O)return;const c=P(t);null!==c&&(_(),E=c.addRipple(n,d))},_=()=>{void 0!==E&&(E.then(t=>t()),E=void 0)},I=t=>{_();const n=e;if(!n)return;const d=T-Date.now()+r;if(t&&d>0&&!m(n)){const c=setTimeout(()=>{n.classList.remove(f),l.delete(n)},T);l.set(n,c)}else n.classList.remove(f)};o.d.addEventListener("ionGestureCaptured",A),o.d.addEventListener("touchstart",t=>{i=(0,u.u)(t),D(t)},!0),o.d.addEventListener("touchcancel",L,!0),o.d.addEventListener("touchend",L,!0),o.d.addEventListener("pointercancel",A,!0),o.d.addEventListener("mousedown",t=>{if(2===t.button)return;const n=(0,u.u)(t)-v;i<n&&D(t)},!0),o.d.addEventListener("mouseup",t=>{const n=(0,u.u)(t)-v;i<n&&R(t)},!0)},g=s=>{if(void 0===s.composedPath)return s.target.closest(".ion-activatable");{const i=s.composedPath();for(let r=0;r<i.length-2;r++){const e=i[r];if(!(e instanceof ShadowRoot)&&e.classList.contains("ion-activatable"))return e}}},m=s=>s.classList.contains("ion-activatable-instant"),P=s=>{if(s.shadowRoot){const i=s.shadowRoot.querySelector("ion-ripple-effect");if(i)return i}return s.querySelector("ion-ripple-effect")},f="ion-activated",k=100,T=150,v=2500}}]);