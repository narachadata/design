// 캘린더·로고·마스코트 그림 (투명 PNG). 프로젝트에서는 "asset:이름" 으로 참조합니다.
// 11/26 성능 조: 예전엔 그림 26장을 base64로 담아 11.7MB를 첫 화면에서 받았음 → 같은 그림 파일(assets/이름.png) 주소로 — 쓰는 그림만 그때 받음
window.NARACAL_ASSETS = {
 "backcover-logo": "assets/backcover-logo.png",
 "cover-group": "assets/cover-group.png",
 "footer-wordmark": "assets/footer-wordmark.png",
 "illu-01-pride": "assets/illu-01-pride.png",
 "illu-02-morality": "assets/illu-02-morality.png",
 "illu-03-consideration": "assets/illu-03-consideration.png",
 "illu-04-responsibility": "assets/illu-04-responsibility.png",
 "illu-05-respect": "assets/illu-05-respect.png",
 "illu-06-humility": "assets/illu-06-humility.png",
 "illu-07-forgiveness": "assets/illu-07-forgiveness.png",
 "illu-08-friendship": "assets/illu-08-friendship.png",
 "illu-09-justice": "assets/illu-09-justice.png",
 "illu-10-honesty": "assets/illu-10-honesty.png",
 "illu-11-fairness": "assets/illu-11-fairness.png",
 "illu-12-cooperation": "assets/illu-12-cooperation.png",
 "logo-wordmark": "assets/logo-wordmark.png",
 "mascot-01": "assets/mascot-01.png",
 "mascot-03": "assets/mascot-03.png",
 "mascot-04": "assets/mascot-04.png",
 "mascot-05": "assets/mascot-05.png",
 "mascot-07": "assets/mascot-07.png",
 "mascot-08": "assets/mascot-08.png",
 "mascot-09": "assets/mascot-09.png",
 "mascot-11": "assets/mascot-11.png",
 "swoosh": "assets/swoosh.png",
 "target-icon": "assets/target-icon.png"
};
// 이모지 장식: 저장소에 있는 것(assets/emoji)은 저장소 주소로 — 인터넷이 막혀도 보이게 (11/26 자료실 조). 없는 것은 예전 인터넷 주소 그대로
window.NC_EMO_LOCAL = new Set(["emoji_u1f1f0_1f1f7.svg", "emoji_u1f308.svg", "emoji_u1f30a.svg", "emoji_u1f319.svg", "emoji_u1f31f.svg", "emoji_u1f330.svg", "emoji_u1f331.svg", "emoji_u1f337.svg", "emoji_u1f338.svg", "emoji_u1f339.svg", "emoji_u1f33b.svg", "emoji_u1f33f.svg", "emoji_u1f340.svg", "emoji_u1f341.svg", "emoji_u1f342.svg", "emoji_u1f349.svg", "emoji_u1f34e.svg", "emoji_u1f35a.svg", "emoji_u1f35d.svg", "emoji_u1f370.svg", "emoji_u1f371.svg", "emoji_u1f380.svg", "emoji_u1f381.svg", "emoji_u1f382.svg", "emoji_u1f383.svg", "emoji_u1f384.svg", "emoji_u1f388.svg", "emoji_u1f389.svg", "emoji_u1f38a.svg", "emoji_u1f392.svg", "emoji_u1f393.svg", "emoji_u1f396.svg", "emoji_u1f3a4.svg", "emoji_u1f3ac.svg", "emoji_u1f3af.svg", "emoji_u1f3b5.svg", "emoji_u1f3b6.svg", "emoji_u1f3c0.svg", "emoji_u1f3c3_200d_2642.svg", "emoji_u1f3c5.svg", "emoji_u1f3c6.svg", "emoji_u1f3cb.svg", "emoji_u1f3e0.svg", "emoji_u1f3e5.svg", "emoji_u1f3eb.svg", "emoji_u1f407.svg", "emoji_u1f411.svg", "emoji_u1f41d.svg", "emoji_u1f44f.svg", "emoji_u1f469_200d_1f393.svg", "emoji_u1f484.svg", "emoji_u1f485.svg", "emoji_u1f48a.svg", "emoji_u1f490.svg", "emoji_u1f499.svg", "emoji_u1f49a.svg", "emoji_u1f49b.svg", "emoji_u1f49c.svg", "emoji_u1f4a1.svg", "emoji_u1f4aa.svg", "emoji_u1f4ac.svg", "emoji_u1f4c5.svg", "emoji_u1f4cc.svg", "emoji_u1f4cd.svg", "emoji_u1f4ce.svg", "emoji_u1f4d6.svg", "emoji_u1f4da.svg", "emoji_u1f4dd.svg", "emoji_u1f4de.svg", "emoji_u1f4e3.svg", "emoji_u1f4f1.svg", "emoji_u1f501.svg", "emoji_u1f514.svg", "emoji_u1f525.svg", "emoji_u1f54a.svg", "emoji_u1f550.svg", "emoji_u1f58c.svg", "emoji_u1f58d.svg", "emoji_u1f64c.svg", "emoji_u1f68c.svg", "emoji_u1f938_200d_2640.svg", "emoji_u1f947.svg", "emoji_u1f948.svg", "emoji_u1f949.svg", "emoji_u1f94a.svg", "emoji_u1f94b.svg", "emoji_u1f950.svg", "emoji_u1f95b.svg", "emoji_u1f973.svg", "emoji_u1f9d1_200d_1f3eb.svg", "emoji_u1f9e1.svg", "emoji_u1f9e3.svg", "emoji_u1f9f4.svg", "emoji_u1f9f8.svg", "emoji_u1f9fc.svg", "emoji_u1fa79.svg", "emoji_u1fa7a.svg", "emoji_u2197.svg", "emoji_u23f0.svg", "emoji_u2600.svg", "emoji_u2615.svg", "emoji_u26a1.svg", "emoji_u26bd.svg", "emoji_u26be.svg", "emoji_u26c4.svg", "emoji_u26c5.svg", "emoji_u26f1.svg", "emoji_u26f7.svg", "emoji_u2702.svg", "emoji_u2705.svg", "emoji_u270f.svg", "emoji_u2714.svg", "emoji_u271d.svg", "emoji_u2728.svg", "emoji_u2744.svg", "emoji_u274c.svg", "emoji_u2753.svg", "emoji_u2757.svg", "emoji_u2764.svg", "emoji_u2795.svg", "emoji_u27a1.svg", "emoji_u2b05.svg", "emoji_u2b06.svg", "emoji_u2b07.svg", "emoji_u2b50.svg", "emoji_u2b55.svg"]);
window.NC_EMO_URL = u => { const m = /\/noto-emoji@v2\.047\/(?:svg|third_party\/region-flags\/waved-svg)\/(emoji_u[0-9a-f_]+\.svg)$/.exec(u || ''); return m && window.NC_EMO_LOCAL.has(m[1]) ? 'assets/emoji/' + m[1] : u; };
