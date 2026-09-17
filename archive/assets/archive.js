/* 旧Wixサイトの動く部品を、Wixに依存せず再現する。
   1) ギャラリーの写真クリックで拡大表示（前後送り・Esc/背景クリックで閉じる）
   2) 横スクロール型ギャラリーの矢印送り */
(function () {
  'use strict';

  // ---------- 1) 拡大表示 ----------
  var box, img, cap, list = [], idx = 0, closeBtn, lastFocus = null;
  var main = document.getElementById('SITE_CONTAINER');
  function build() {
    box = document.createElement('div');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', '写真の拡大表示');
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(255,255,255,.96);display:none;align-items:center;justify-content:center';
    img = document.createElement('img');
    img.style.cssText = 'max-width:calc(100vw - 160px);max-height:calc(100vh - 80px);object-fit:contain;box-shadow:0 2px 20px rgba(0,0,0,.15)';
    cap = document.createElement('div');
    cap.style.cssText = 'position:absolute;left:0;right:0;bottom:14px;text-align:center;font:13px/1.4 sans-serif;color:#555';
    function btn(label, css, fn) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', label);
      b.style.cssText = 'position:absolute;background:none;border:0;cursor:pointer;color:#333;font:300 44px/1 sans-serif;padding:12px 18px;' + css;
      b.textContent = label === '閉じる' ? '×' : (label === '前へ' ? '‹' : '›');
      b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
      box.appendChild(b); return b;
    }
    closeBtn = btn('閉じる', 'top:6px;right:10px', close);
    btn('前へ', 'left:10px;top:50%;transform:translateY(-50%)', function () { show(idx - 1); });
    btn('次へ', 'right:10px;top:50%;transform:translateY(-50%)', function () { show(idx + 1); });
    box.appendChild(img); box.appendChild(cap);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.body.appendChild(box);
  }
  function show(i) {
    if (!list.length) return;
    idx = (i + list.length) % list.length;
    img.src = list[idx].src; img.alt = list[idx].alt || '';
    cap.textContent = list[idx].alt && !/\.(jpe?g|png)$/i.test(list[idx].alt) ? list[idx].alt : '';
  }
  function openList(imgs, start, opener) {
    if (!box) build();
    list = imgs.map(function (el) { return { src: el.currentSrc || el.src, alt: el.alt }; });
    show(Math.max(0, start));
    lastFocus = opener || document.activeElement;
    box.style.display = 'flex'; document.documentElement.style.overflow = 'hidden';
    // 拡大表示の後ろは、読み上げソフトからも触れないようにする
    if (main) main.setAttribute('aria-hidden', 'true');
    if (closeBtn) closeBtn.focus();
  }
  function open(gallery, target, opener) {
    var all = [].slice.call(gallery.querySelectorAll('img[data-hook="gallery-item-image-img"]'));
    openList(all, all.indexOf(target), opener);
  }
  function close() {
    box.style.display = 'none'; document.documentElement.style.overflow = '';
    if (main) main.removeAttribute('aria-hidden');
    // 開く前に触っていた場所へ焦点を戻す
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }
  document.addEventListener('keydown', function (e) {
    if (!box || box.style.display !== 'flex') return;
    if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); }
    else if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'Tab') {
      // 拡大表示を開いている間は、Tab が後ろのページ本体へ抜けないようにする
      var f = [].slice.call(box.querySelectorAll('button'));
      if (!f.length) return;
      var at = f.indexOf(document.activeElement);
      var to = e.shiftKey ? (at <= 0 ? f.length - 1 : at - 1) : (at === f.length - 1 ? 0 : at + 1);
      e.preventDefault(); f[to].focus();
    }
  });
  function openFromItem(item, opener) {
    var target = item.querySelector('img[data-hook="gallery-item-image-img"]');
    var gallery = item.closest('.pro-gallery') || document;
    if (!target) return false;
    open(gallery, target, opener || item.querySelector('[data-hook="item-action"]') || item);
    return true;
  }
  document.addEventListener('click', function (e) {
    var item = e.target.closest && e.target.closest('[data-hook="item-container"].clickable');
    if (!item) return;
    if (openFromItem(item)) e.preventDefault();
  });
  // 写真の枠は本物では div（role="button"）のため、Enter とスペースでは押したことにならない。ここで補う
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    if (box && box.style.display === 'flex') return;
    var t = e.target.closest && e.target.closest('[data-hook="item-action"], [data-testid="gallery-item-click-action-image-zoom"]');
    if (!t) return;
    var item = t.closest('[data-hook="item-container"].clickable');
    if (item) { if (openFromItem(item, t)) e.preventDefault(); return; }
    var slide = t.closest('[data-testid="slide-show-gallery"]');
    if (slide && slide.__openZoom) { e.preventDefault(); slide.__openZoom(t); }
  });

  // ---------- 4) スライドショー: 約3.5秒ごとに自動で切り替え（本物の実測 3.43〜3.64秒）、クリックで拡大 ----------
  [].forEach.call(document.querySelectorAll('[data-testid="slide-show-gallery"]'), function (g) {
    var ghosts = [].slice.call(g.querySelectorAll('[data-testid="gallery-item-ghost"] img'));
    var cur = g.querySelector('[data-testid="slide-show-gallery-items"] img');
    if (!cur || ghosts.length < 2) return;
    var i = Math.max(0, ghosts.map(function (x) { return x.getAttribute('src'); }).indexOf(cur.getAttribute('src')));
    setInterval(function () {
      if (document.hidden) return;
      i = (i + 1) % ghosts.length;
      cur.setAttribute('src', ghosts[i].getAttribute('src'));
    }, 3500);
    g.__openZoom = function (opener) { openList(ghosts, i, opener); };
    g.addEventListener('click', function (e) {
      var z = e.target.closest('[data-testid="gallery-item-click-action-image-zoom"]');
      if (!z) return;
      e.preventDefault(); openList(ghosts, i, z);
    });
  });

  // ---------- 3) Wix動画ウィジェット: 再生ボタンで同じ枠にYouTubeを再生 ----------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-hook="overlay-play-button"]');
    if (!btn) return;
    var wrap = btn.closest('[data-yt]'); if (!wrap || !wrap.getAttribute('data-yt')) return;
    e.preventDefault();
    var box = wrap.querySelector('[data-hook="thumbnail-cover"]') || wrap;
    var r = box.getBoundingClientRect();
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + wrap.getAttribute('data-yt') + '?autoplay=1&rel=0';
    f.title = (wrap.querySelector('[data-hook="title"]') || {}).textContent || 'YouTube';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    f.setAttribute('allowfullscreen', '');
    f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:5;background:#000';
    var host = box; if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    if (r.height < 20) host.style.minHeight = '240px';
    host.appendChild(f);
  });


  // ---------- 5) 「▲」ページ上部へ戻る／「メインコンテンツにスキップ」 ----------
  document.addEventListener('click', function (e) {
    var top = e.target.closest && e.target.closest('[data-anchor="SCROLL_TO_TOP"]');
    if (top) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // なめらかなスクロールが進まない環境（非表示のタブ等）でも確実に最上部へ戻す
      setTimeout(function () { if (window.scrollY > 0) window.scrollTo(0, 0); }, 900);
      return;
    }
    var skip = e.target.closest && e.target.closest('#SKIP_TO_CONTENT_BTN');
    if (skip) {
      e.preventDefault();
      var t = document.getElementById('PAGES_CONTAINER') || document.querySelector('main,[role="main"]');
      if (t) { if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); t.scrollIntoView({ block: 'start' }); }
    }
  });

  // ---------- 7) 表示できない写真をギャラリーから取り除いて詰める ----------
  // 旧サイトでは Wix 側にファイルが残っておらず「読み込めない画像」のまま並んでいた写真がある。
  // アーカイブでは見た目を整えるため、その枠を取り除いて後ろの写真を前に詰める（クライアント指示・2026-09-16）。
  // 本文中の画像（ギャラリー以外）は対象外。
  (function () {
    // 同じギャラリーを二重に処理しないよう、横スクロールの枠（無ければ入れ子でない pro-gallery）を単位にする
    var boxes = [].slice.call(document.querySelectorAll('.gallery-horizontal-scroll'));
    [].forEach.call(document.querySelectorAll('.pro-gallery'), function (g) {
      if (g.querySelector('.gallery-horizontal-scroll')) return;
      if (boxes.some(function (b) { return b.contains(g) || g.contains(b); })) return;
      boxes.push(g);
    });
    boxes.forEach(function (box) {
      var dead = [].filter.call(box.querySelectorAll('img'), function (i) {
        return (i.getAttribute('src') || '').indexOf('_not_available') >= 0 || (i.getAttribute('srcset') || '').indexOf('_not_available') >= 0;
      });
      if (!dead.length) return;
      dead.forEach(function (img) {
        var cont = img.closest('[data-hook="item-container"]');
        if (!cont) return;
        // 写真1枚ぶんの入れ物（グループ枠 → リンク枠 → 本体）の一番外側を消す
        var node = cont;
        while (node.parentNode && node.parentNode !== box && node.parentNode.children.length === 1) node = node.parentNode;
        if (node.parentNode) node.parentNode.removeChild(node);
      });
      var items = [].slice.call(box.querySelectorAll('[data-hook="item-container"]'));
      if (!items.length) return;
      var info = items.map(function (e) {
        var grp = e.closest('[style*="--group-left"]');
        return { el: e, grp: grp, left: parseFloat(e.style.left) || 0, top: parseFloat(e.style.top) || 0, w: parseFloat(e.style.width) || e.offsetWidth };
      });
      // 1行に並ぶギャラリーだけ詰める（格子状のものは触らない）
      var tops = info.map(function (v) { return Math.round(v.top); });
      if (tops.some(function (t) { return t !== tops[0]; })) return;
      info.sort(function (a, b) { return a.left - b.left; });
      var gap = 20;
      for (var i = 1; i < info.length; i++) {
        var d = Math.round(info[i].left - (info[i - 1].left + info[i - 1].w));
        if (d > 0 && d < 200) { gap = d; break; }
      }
      var start = info[0].left, x = start;
      info.forEach(function (v) {
        v.el.style.left = x + 'px';
        if (v.el.style.inset) v.el.style.inset = v.top + 'px auto auto ' + x + 'px';
        if (v.grp) v.grp.style.setProperty('--group-left', x + 'px');
        x += v.w + gap;
      });
      var total = x - gap - start + (parseFloat(getComputedStyle(info[0].el).marginLeft) || 0) * 2;
      // 横スクロールの長さを決めている枠の幅も詰める
      [].forEach.call(box.querySelectorAll('[style*="width"]'), function (e) {
        var wv = parseFloat(e.style.width);
        if (wv && wv > total && e.querySelector('[data-hook="item-container"]')) e.style.width = total + 'px';
      });
    });
  })();

  // ---------- 8) 改行位置を固定した段落が収まらない端末では、固定をやめて自然に折り返す ----------
  // 本物の PC 表示と同じ位置で改行するよう固定しているが、iPad の Safari は文字を少し拡大する（14px → 15px。実機で確認）ため、
  // 固定したままだと行が右へはみ出して切れる。はみ出した段落だけ、本物の iPad と同じく自然な折り返しに戻す。
  (function () {
    var paras = [].slice.call(document.querySelectorAll('[data-arc-lines]'));
    if (!paras.length) return;
    function check() {
      paras.forEach(function (el) {
        el.removeAttribute('data-arc-wrap');
        var box = el.getBoundingClientRect(); if (!box.width) return;
        var rg = document.createRange(); rg.selectNodeContents(el);
        var right = 0; [].forEach.call(rg.getClientRects(), function (r) { if (r.right > right) right = r.right; });
        // PC では本物も枠をわずかに（実測 最大8px）越えて表示しているので、それより大きくはみ出した時だけ切り替える
        if (right > box.right + 12) el.setAttribute('data-arc-wrap', '');
      });
    }
    check();
    window.addEventListener('load', check);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(check, 150); });
  })();

  // ---------- 2) 横スクロール型ギャラリーの矢印 ----------
  [].forEach.call(document.querySelectorAll('.gallery-horizontal-scroll'), function (sc) {
    var root = sc.closest('.pro-gallery') || sc.parentNode;
    var next = root.querySelector('[data-hook="nav-arrow-next"]');
    var prev = root.querySelector('[data-hook="nav-arrow-prev"]');
    if (next && !prev) {
      prev = next.cloneNode(true);
      prev.setAttribute('data-hook', 'nav-arrow-prev'); prev.setAttribute('aria-label', 'Previous Item');
      prev.style.right = ''; prev.style.left = next.style.right || '33px';
      var svg = prev.querySelector('svg'); if (svg) svg.style.transform = 'scaleX(-1)';
      next.parentNode.insertBefore(prev, next);
    }
    function step() {
      var g = sc.querySelector('[data-hook="group-view"]');
      return g ? g.getBoundingClientRect().width : sc.clientWidth;
    }
    function update() {
      var max = sc.scrollWidth - sc.clientWidth - 2;
      if (prev) prev.style.visibility = sc.scrollLeft > 2 ? 'visible' : 'hidden';
      if (next) next.style.visibility = sc.scrollLeft < max ? 'visible' : 'hidden';
    }
    sc.style.overflowX = 'auto';
    if (next) next.addEventListener('click', function (e) { e.preventDefault(); sc.scrollBy({ left: step(), behavior: 'smooth' }); });
    if (prev) prev.addEventListener('click', function (e) { e.preventDefault(); sc.scrollBy({ left: -step(), behavior: 'smooth' }); });
    sc.addEventListener('scroll', update, { passive: true });
    update();
  });

  // ---------- 6) メニューの下層（ドロップダウン） ----------
  // 本物の Wix はマウスを乗せた時に下層を JS で組み立てる。組み立て後の構造と位置を本物から写し取ったもの。
  // スマホ・タブレット（Wix が端末判定で縮小表示にする端末）では、1回目のタップで下層を開き、2回目で移動する（本物と同じ）。
  (function () {
    var DROP = {"2": {"left": "-8px", "html": "<li id=\"comp-kep43s1bmoreContainer0\" data-direction=\"ltr\" data-listposition=\"top\" data-data-id=\"dataItem-ki1aqmmx\" data-state=\"drop false  link\" data-index=\"0\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 420px;\"><a data-testid=\"linkElement\" href=\"%E7%A4%BE%E4%BC%9A%E6%B4%BB%E5%8B%95%E3%81%B8%E3%81%AE%E5%AD%A6%E7%94%9F%E5%8F%82%E5%8A%A01.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer0label\" style=\"min-width: 0px; line-height: 29px;\">社会活動への学生参加(1)―― AHI (アジア保健研修所) と学ぶ会</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer1\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-lual964y\" data-state=\"drop false  link\" data-index=\"1\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 420px;\"><a data-testid=\"linkElement\" href=\"%E7%A4%BE%E4%BC%9A%E6%B4%BB%E5%8B%95%E3%81%B8%E3%81%AE%E5%AD%A6%E7%94%9F%E5%8F%82%E5%8A%A0-2%E5%A4%9A%E6%96%87%E5%8C%96%E5%85%B1%E7%94%9F%E3%83%97%E3%83%AD%E3%82%B8%E3%82%A7%E3%82%AF%E3%83%88.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer1label\" style=\"min-width: 0px; line-height: 29px;\">社会活動への学生参加(2)――多文化共生プロジェクト</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer2\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-l0bynr89\" data-state=\"drop false  link\" data-index=\"2\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 420px;\"><a data-testid=\"linkElement\" href=\"%E7%A4%BE%E4%BC%9A%E6%B4%BB%E5%8B%95%E3%81%B8%E3%81%AE%E5%AD%A6%E7%94%9F%E5%8F%82%E5%8A%A03.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer2label\" style=\"min-width: 0px; line-height: 29px;\">社会活動への学生参加(3)――徳林寺、福慧寺</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer3\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-kvdeh32w\" data-state=\"drop false  link\" data-index=\"3\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 420px;\"><a data-testid=\"linkElement\" href=\"%E7%A4%BE%E4%BC%9A%E6%B4%BB%E5%8B%95%E3%81%B8%E3%81%AE%E5%AD%A6%E7%94%9F%E5%8F%82%E5%8A%A04.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer3label\" style=\"min-width: 0px; line-height: 29px;\">社会活動への学生参加(4)――四日市とのかかわり</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer4\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-kvdehdzh\" data-state=\"drop false  link\" data-index=\"4\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 420px;\"><a data-testid=\"linkElement\" href=\"%E7%A4%BE%E4%BC%9A%E6%B4%BB%E5%8B%95%E3%81%B8%E3%81%AE%E5%AD%A6%E7%94%9F%E5%8F%82%E5%8A%A05.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer4label\" style=\"min-width: 0px; line-height: 29px;\">社会活動への学生参加(5)――その他</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer5\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-ki1an4qr\" data-state=\"drop false  link\" data-index=\"5\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 420px;\"><a data-testid=\"linkElement\" href=\"out-of-class-lesson-copy.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer5label\" style=\"min-width: 0px; line-height: 29px;\">Out-of-Class Lesson</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer6\" data-direction=\"ltr\" data-listposition=\"bottom\" data-data-id=\"dataItem-kepaevpj\" data-state=\"drop false  link\" data-index=\"6\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 420px;\"><a data-testid=\"linkElement\" href=\"out-of-class-lesson-2.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer6label\" style=\"min-width: 0px; line-height: 29px;\">Out-of-Class Lesson 2</p></div></div></a></li>"}, "3": {"left": "152.5px", "html": "<li id=\"comp-kep43s1bmoreContainer0\" data-direction=\"ltr\" data-listposition=\"top\" data-data-id=\"dataItem-lg0sdff0\" data-state=\"drop false  link\" data-index=\"0\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 447px;\"><a data-testid=\"linkElement\" href=\"%E5%B9%B3%E5%B1%B1%E3%82%BC%E3%83%9F%E5%8D%92%E6%A5%AD%E8%AB%96%E6%96%87.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer0label\" style=\"min-width: 0px; line-height: 29px;\">平山ゼミ卒業論文</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer1\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-lualrf0z\" data-state=\"drop false  link\" data-index=\"1\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 447px;\"><a data-testid=\"linkElement\" href=\"2023%E5%B9%B4%E5%BA%A6creative-presentation.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer1label\" style=\"min-width: 0px; line-height: 29px;\">「2023年度Creative Presentation」</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer2\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-lc79v7bj\" data-state=\"drop false  link\" data-index=\"2\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 447px;\"><a data-testid=\"linkElement\" href=\"2022%E5%B9%B4%E5%BA%A6creativepresentation.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer2label\" style=\"min-width: 0px; line-height: 29px;\">「2022年度Creative Presentation」</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer3\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-l0bzloz2\" data-state=\"drop false  link\" data-index=\"3\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 447px;\"><a data-testid=\"linkElement\" href=\"2021%E5%B9%B4%E5%BA%A6%E8%8B%B1%E8%AA%9E%E7%A0%94%E4%BF%AEsdgsworkshop.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer3label\" style=\"min-width: 0px; line-height: 29px;\">「2021年度英語研修 SDGs Workshop」</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer4\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-kepclg3l\" data-state=\"drop false  link\" data-index=\"4\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 447px;\"><a data-testid=\"linkElement\" href=\"2019%E5%B9%B4%E5%BA%A6-%E6%B5%B7%E5%A4%96%E7%A0%94%E4%BF%AE-iii-a-%E4%B8%AD%E6%AD%A2%E5%BE%8C%E3%81%AE%E7%89%B9%E5%88%A5%E6%8E%88%E6%A5%AD.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer4label\" style=\"min-width: 0px; line-height: 29px;\">「2019年度 海外研修 III A 」\n中止後の特別授業</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer5\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-kepcm63k\" data-state=\"drop false  link\" data-index=\"5\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 447px;\"><a data-testid=\"linkElement\" href=\"2018%E5%B9%B4%E5%BA%A6-%E6%B5%B7%E5%A4%96%E7%A0%94%E4%BF%AE-iii-a-%E8%A8%AA%E5%95%8F%E5%85%88.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer5label\" style=\"min-width: 0px; line-height: 29px;\">「2018年度 海外研修 III A 」訪問先</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer6\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-kepcms9b\" data-state=\"drop false  link\" data-index=\"6\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 447px;\"><a data-testid=\"linkElement\" href=\"2018%E5%B9%B4%E5%BA%A6-%E6%B5%B7%E5%A4%96%E7%A0%94%E4%BF%AE-iii-a-%E4%BA%8B%E5%89%8D%E5%AD%A6%E7%BF%92.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer6label\" style=\"min-width: 0px; line-height: 29px;\">「2018年度 海外研修 III A 」事前学習</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer7\" data-direction=\"ltr\" data-listposition=\"dropCenter\" data-data-id=\"dataItem-kepcnaeg\" data-state=\"drop false  link\" data-index=\"7\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 447px;\"><a data-testid=\"linkElement\" href=\"2017%E5%B9%B4%E5%BA%A6-%E5%9C%B0%E5%9F%9F%E7%A0%94%E7%A9%B6-%E5%9B%BD%E9%9A%9B%E7%A0%94%E4%BF%AE%E3%83%97%E3%83%AD%E3%82%B0%E3%83%A9%E3%83%A0-%E3%83%95%E3%82%A3%E3%83%AA%E3%83%94%E3%83%B3-%E8%A8%AA%E5%95%8F%E5%85%88.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer7label\" style=\"min-width: 0px; line-height: 29px;\">「2017年度 地域研究・国際研修プログラム(フィリピン)」訪問先</p></div></div></a></li><li id=\"comp-kep43s1bmoreContainer8\" data-direction=\"ltr\" data-listposition=\"bottom\" data-data-id=\"dataItem-kepcntnu\" data-state=\"drop false  link\" data-index=\"8\" data-dropdown=\"true\" class=\"NV2Ozs CUYeWp\" style=\"min-width: 447px;\"><a data-testid=\"linkElement\" href=\"2017%E5%B9%B4%E5%BA%A6-%E5%9C%B0%E5%9F%9F%E7%A0%94%E7%A9%B6-%E5%9B%BD%E9%9A%9B%E7%A0%94%E4%BF%AE%E3%83%97%E3%83%AD%E3%82%B0%E3%83%A9%E3%83%A0-%E3%83%95%E3%82%A3%E3%83%AA%E3%83%94%E3%83%B3-%E4%BA%8B%E5%89%8D%E5%AD%A6%E7%BF%92.html\" target=\"_self\" class=\"qMvpu5\"><div class=\"EWeavx\"><div class=\"\"><p class=\"wGxoBM\" id=\"comp-kep43s1bmoreContainer8label\" style=\"min-width: 0px; line-height: 29px;\">「2017年度 地域研究・国際研修プログラム(フィリピン)」事前学習</p></div></div></a></li>"}};
    var menu = document.getElementById('comp-kep43s1b');
    var wrap = document.getElementById('comp-kep43s1bdropWrapper');
    var ul = document.getElementById('comp-kep43s1bmoreContainer');
    if (!menu || !wrap || !ul) return;
    var touchUA = /iPhone|iPod|iPad|Android|Silk|Kindle|Mobile/i.test(navigator.userAgent);
    var openIdx = null, timer = null, openedAt = 0, lastTouchAt = 0;
    // iPad のデスクトップ表示モードは UA が Mac と同じになるため、UA ではなく実際の入力で指の操作かを見分ける
    var markTouch = function (e) { if (!e.pointerType || e.pointerType === 'touch' || e.pointerType === 'pen') lastTouchAt = Date.now(); };
    document.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch' || e.pointerType === 'pen') markTouch(e); }, true);
    document.addEventListener('touchstart', markTouch, { capture: true, passive: true });
    function topItem(i) { return menu.querySelector('li[data-index="' + i + '"]:not([data-dropdown])'); }
    function open(i) {
      clearTimeout(timer);
      if (openIdx === i) return;
      close(true);
      var d = DROP[i], li = topItem(i); if (!d || !li) return;
      ul.innerHTML = d.html; ul.setAttribute('data-hover', i);
      // 今いるページの項目は本物と同じく「選択中」の状態にする
      [].forEach.call(ul.querySelectorAll('li'), function (x) {
        var h = x.querySelector('a'); if (!h) return;
        var here = decodeURIComponent(location.pathname).replace(/\.html$/, '').replace(/\/$/, '');
        var to = decodeURIComponent(h.getAttribute('href')).replace(/\.html$/, '').replace(/\/$/, '');
        if (here.slice(-to.length) === to) x.setAttribute('data-state', 'drop selected  link');
      }); ul.style.left = d.left; ul.style.right = 'auto';
      wrap.classList.add('mmODQd'); wrap.setAttribute('data-dropdown-shown', 'true'); wrap.setAttribute('data-drophposition', 'center');
      wrap.style.inset = '30px auto auto ' + d.left;
      menu.setAttribute('data-hovered-item', i);
      openedAt = Date.now();
      var a = li.querySelector('a[aria-haspopup]'); if (a) a.setAttribute('aria-expanded', 'true');
      var b = li.querySelector('button'); if (b) b.classList.add('Ln3X5V');
      openTrigger = a || b || li;
      openIdx = i;
    }
    var openTrigger = null;
    function close(fromOpen) {
      clearTimeout(timer);
      if (openIdx === null) return;
      var li = openIdx === 'more' ? null : topItem(openIdx);
      if (li) { var a = li.querySelector('a[aria-haspopup]'); if (a) a.setAttribute('aria-expanded', 'false'); var b = li.querySelector('button'); if (b) b.classList.remove('Ln3X5V'); }
      // 下層の項目に焦点があるまま消すと行き場を失うので、開いた元へ戻す
      var inside = openTrigger && wrap.contains(document.activeElement);
      ul.innerHTML = ''; ul.removeAttribute('data-hover'); ul.removeAttribute('style');
      if (inside) { try { openTrigger.focus(); } catch (e) {} }
      openTrigger = null;
      wrap.classList.remove('mmODQd'); wrap.setAttribute('data-dropdown-shown', 'false'); wrap.removeAttribute('data-drophposition'); wrap.removeAttribute('style');
      menu.removeAttribute('data-hovered-item');
      var mb = document.querySelector('#comp-kep43s1b__more__ [aria-haspopup]');
      if (mb) mb.setAttribute('aria-expanded', 'false');
      openIdx = null;
      // 開いている間は見送った測り直しを、閉じてから行う
      if (pendingFit && !fromOpen) { pendingFit = false; fit(); }
    }
    function later() { clearTimeout(timer); timer = setTimeout(close, 150); }
    Object.keys(DROP).forEach(function (i) {
      var li = topItem(i); if (!li) return;
      // スマホ・タブレットではタップの直前に疑似的な「マウスが乗った」合図が来るため、乗せて開く動きはPCだけにする
      if (!touchUA) {
        li.addEventListener('mouseenter', function () { open(i); }); li.addEventListener('mouseleave', later);
        li.addEventListener('focusin', function () { open(i); });
      }
      var a = li.querySelector('a[aria-haspopup]');
      if (a) a.addEventListener('click', function (e) {
        var now = Date.now();
        var byTouch = touchUA || now - lastTouchAt < 1000;
        if (!byTouch) return;
        // 閉じていた、または同じタップで「マウスが乗った」合図により今開いたばかり、なら移動せずに下層を見せる
        // （1回のタップで click が2回届く端末もあるため、開いた直後の click もここで止める）
        if (openIdx !== i || now - openedAt < 700) { e.preventDefault(); open(i); }
      });
      var b = li.querySelector('button');
      if (b) b.addEventListener('click', function (e) { e.preventDefault(); if (openIdx === i) close(); else open(i); });
    });
    // 他のメニュー項目に移ったら閉じる
    [].forEach.call(menu.querySelectorAll('li[data-index]:not([data-dropdown])'), function (li) {
      if (!DROP[li.getAttribute('data-index')] && !touchUA) {
        li.addEventListener('mouseenter', function () { close(); });
        li.addEventListener('focusin', function () { close(); });
      }
    });
    if (!touchUA) { wrap.addEventListener('mouseenter', function () { clearTimeout(timer); }); wrap.addEventListener('mouseleave', later); }

    // キーボード: 下層の枠は DOM の末尾にあるため、そのままでは Tab で親項目から下層へ入れない。
    // 親項目で Tab → 下層の先頭、下層の先頭で Shift+Tab → 親項目、下層の末尾で Tab → 次の上位項目 とつなぐ
    // 上位項目ごとに、利用者が Tab で止まる要素（項目のリンク、または「その他」の枠）を1つずつ集める
    function focusables() {
      return [].map.call(menu.querySelectorAll('li[data-index]:not([data-dropdown])'), function (li) {
        if (li.style.display === 'none' || li.getAttribute('aria-hidden') === 'true') return null;
        return li.querySelector('a[href], [tabindex="0"]');
      }).filter(Boolean);
    }
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || openIdx === null) return;
      var links = [].slice.call(ul.querySelectorAll('a[href]'));
      if (!links.length) return;
      var t = e.target;
      if (!e.shiftKey && openTrigger && (t === openTrigger || openTrigger.contains(t))) { e.preventDefault(); links[0].focus(); return; }
      if (e.shiftKey && t === links[0]) { e.preventDefault(); openTrigger.focus(); return; }
      if (!e.shiftKey && t === links[links.length - 1]) {
        var f = focusables(), at = f.indexOf(openTrigger);
        if (at >= 0 && at < f.length - 1) { e.preventDefault(); f[at + 1].focus(); }
      }
    });
    // 焦点がメニューの外へ出たら、開いている下層を閉じる
    document.addEventListener('focusin', function (e) { if (openIdx !== null && !menu.contains(e.target)) close(); });

    // 画面が狭くてメニューが一列に収まらない時、本物と同じく後ろの項目を「その他」へたたむ
    // （iPad のデスクトップ表示モードなど、表示幅が980pxより狭くなる端末で起きる）
    var more = menu.querySelector('li[data-index]:not([data-dropdown]) [id$="__more__label"]');
    var moreLi = more ? more.closest('li') : menu.querySelector('#comp-kep43s1b__more__') || menu.querySelector('li:last-child');
    var nav = document.getElementById('comp-kep43s1bnavContainer');
    var tops = [].slice.call(menu.querySelectorAll('li[data-index]:not([data-dropdown])'));
    // 幅が足りているかは「文字が枠に収まっているか」で判断する（幅の計算に頼らない）。
    // 収まらない端末（iPad のデスクトップ表示モードなど）では、後ろの項目から「その他」へ移す。
    // 代替書体では一部の項目名が Wix の決めた枠より広くなり、隣に重なる（iPad 実機で確認）。
    // その場合は項目の枠を文字なりの幅にしてから、収まらない分だけ「その他」へ移す。
    function showMore(on) {
      if (on) {
        moreLi.style.visibility = 'visible'; moreLi.setAttribute('aria-hidden', 'false');
        moreLi.style.height = ''; moreLi.style.overflow = 'visible'; moreLi.style.position = 'relative';
      } else {
        moreLi.style.visibility = 'hidden'; moreLi.setAttribute('aria-hidden', 'true');
        moreLi.style.height = '0px'; moreLi.style.overflow = 'hidden'; moreLi.style.position = 'absolute';
      }
    }
    // 行の右端がメニュー枠の右端をはみ出していたら、後ろの項目を「その他」へ移す
    function rowRight(visible, hasMore) {
      var last = hasMore ? moreLi : visible[visible.length - 1];
      return last ? last.getBoundingClientRect().right : 0;
    }
    var pendingFit = false;
    function fit() {
      if (!moreLi || !nav) return;
      // メニューを開いている間は測り直さない（利用者の操作を取り消さないため）
      if (openIdx !== null) { pendingFit = true; return; }
      tops.forEach(function (li) { li.style.display = ''; li.style.width = ''; });
      showMore(false);
      var limit = nav.getBoundingClientRect().right + 2;
      var visible = tops.slice(), hidden = [];
      for (var guard = 0; guard < tops.length && visible.length > 1; guard++) {
        if (rowRight(visible, hidden.length > 0) <= limit) break;
        var li = visible.pop(); li.style.display = 'none'; hidden.unshift(li); showMore(true);
      }
      window.__fit = { limit: Math.round(limit), hidden: hidden.length, endRight: Math.round(rowRight(visible, hidden.length > 0)) };
      MORE_ITEMS = hidden.length ? hidden.map(function (li) {
        var a = li.querySelector('a');
        return { href: a ? a.getAttribute('href') : '#', text: (li.textContent || '').trim(), idx: li.getAttribute('data-index') };
      }) : null;
      if (!hidden.length) showMore(false);
    }
    var MORE_ITEMS = null;
    // 「その他」を開いた時の中身を、下層メニューと同じ作りで組み立てる
    function moreHtml() {
      if (!MORE_ITEMS) return '';
      var w = Math.max.apply(null, MORE_ITEMS.map(function (m) { return m.text.length * 14 + 40; }).concat([180]));
      return MORE_ITEMS.map(function (m, n) {
        var pos = MORE_ITEMS.length === 1 ? 'top' : (n === 0 ? 'top' : (n === MORE_ITEMS.length - 1 ? 'bottom' : 'dropCenter'));
        return '<li id="comp-kep43s1bmoreContainer' + n + '" data-direction="ltr" data-listposition="' + pos + '" data-state="drop false  link" data-index="' + n + '" data-dropdown="true" class="NV2Ozs CUYeWp" style="min-width: ' + w + 'px;">' +
          '<a data-testid="linkElement" href="' + m.href + '" target="_self" class="qMvpu5"><div class="EWeavx"><div class="">' +
          '<p class="wGxoBM" id="comp-kep43s1bmoreContainer' + n + 'label" style="min-width: 0px; line-height: 29px;">' + m.text + '</p></div></div></a></li>';
      }).join('');
    }
    if (moreLi) {
      var openMore = function () {
        if (!MORE_ITEMS) return;
        close(true);
        var r = moreLi.getBoundingClientRect(), nr = nav.getBoundingClientRect();
        ul.innerHTML = moreHtml(); ul.setAttribute('data-hover', 'more'); ul.style.right = 'auto';
        // いったん仮置きして幅を測り、画面からはみ出さない位置に収める
        ul.style.left = '0px';
        wrap.classList.add('mmODQd'); wrap.setAttribute('data-dropdown-shown', 'true'); wrap.setAttribute('data-drophposition', 'center');
        wrap.style.inset = '30px auto auto 0px';
        var w = ul.getBoundingClientRect().width || 200;
        var x = Math.round(Math.min(Math.max(0, r.left - nr.left), Math.max(0, nr.width - w)));
        var left = x + 'px';
        wrap.style.inset = '30px auto auto ' + left;
        if (moreBtn) moreBtn.setAttribute('aria-expanded', 'true');
        openTrigger = moreBtn || moreLi;
        openIdx = 'more';
      };
      var moreBtn = moreLi.querySelector('[aria-haspopup]');
      if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
      if (moreBtn) moreBtn.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        e.preventDefault();
        if (openIdx === 'more') close(); else openMore();
      });
      // iPad のデスクトップ表示モードでは、指でふれた時に「マウスが乗った」合図が先に届く。
      // 直後の押した合図で閉じてしまわないよう、乗って開いた時刻を覚えておく
      var hoverOpenAt = 0;
      if (!touchUA) {
        moreLi.addEventListener('mouseenter', function () { openMore(); hoverOpenAt = Date.now(); });
        moreLi.addEventListener('mouseleave', later);
      }
      // タッチ端末では1回の指タップで click が続けて2回届くことがあるため、直後の重複は無視する
      var lastToggle = 0;
      moreLi.addEventListener('click', function (e) {
        e.preventDefault();
        var now = Date.now(); if (now - lastToggle < 400) return; lastToggle = now;
        if (openIdx === 'more' && now - hoverOpenAt < 700) return;
        if (openIdx === 'more') close(); else openMore();
      });
    }
    // 調査用: ?diag=1 を付けて開くと、メニューの実測値を画面上部に表示する（本番の表示には影響しない）
    if (/[?&]diag=1/.test(location.search)) {
      setTimeout(function () {
        var d = document.createElement('div');
        d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#111;color:#0f0;font:11px/1.35 monospace;padding:6px;white-space:pre-wrap';
        var navR = nav.getBoundingClientRect();
        var lines = ['innerW=' + innerWidth + ' visualScale=' + (visualViewport ? visualViewport.scale.toFixed(3) : '-') + ' navW=' + Math.round(navR.width) + ' navRight=' + Math.round(navR.right),
                     'fit=' + JSON.stringify(window.__fit || null)];
        tops.concat([moreLi]).forEach(function (li) {
          var q = li.querySelector('p') || li, r = li.getBoundingClientRect();
          lines.push((li.textContent || '').trim().slice(0, 6) + ' liW=' + Math.round(r.width) + ' right=' + Math.round(r.right) + ' pScroll=' + q.scrollWidth + ' pClient=' + q.clientWidth + ' disp=' + (li.style.display || '-') + ' vis=' + getComputedStyle(li).visibility);
        });
        d.textContent = lines.join('\n');
        document.body.appendChild(d);
      }, 2500);
    }

    // 書体や写真の読み込みで幅が変わるため、表示が落ち着くまで何度か測り直す
    var refit = function () { fit(); };
    fit();
    [100, 400, 1200, 2500].forEach(function (ms) { setTimeout(refit, ms); });
    var hardTimer = null;
    var hardRefit = function () {
      clearTimeout(hardTimer);
      hardTimer = setTimeout(function () { close(); pendingFit = false; fit(); }, 120);
    };
    window.addEventListener('resize', hardRefit);
    window.addEventListener('orientationchange', hardRefit);
    window.addEventListener('load', refit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  })();
})();
