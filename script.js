
function reconstruct() {
    const vals = {
        t: document.getElementById('t').value,
        p: document.getElementById('p').value,
        l: document.getElementById('l').value,
        e: document.getElementById('e').value
    };

    if(Object.values(vals).some(v => !v)) return;

    const root = document.documentElement;
    const log = document.getElementById('log');
    const container = document.getElementById('singularity-container');
    const mainBlob = document.getElementById('main-blob');

    // --- 核心邏輯：全句語意聯動 ---
    let h = 200, en = 50;

    // 1. 聯繫：地點決定顏色 (太陽 -> 橘紅)
    if(vals.l.includes("太陽") || vals.l.includes("火")) h = 15;
    else if(vals.l.includes("海")) h = 210;
    else h = Math.random() * 360;

    // 2. 聯繫：人物與事件決定「擴張感」與「活躍度」
    let isViolent = false;
    if(vals.e.includes("大叫") || vals.e.includes("爆炸") || vals.p.includes("龍")) {
        en = 500; // 極高能量
        isViolent = true;
    } else if(vals.e.includes("睡") || vals.e.includes("靜")) {
        en = 20; // 極低能量
    }

    // 3. 視覺突變：執行重構動作
    root.style.setProperty('--hue', h);
    root.style.setProperty('--energy', en);

    if (isViolent) {
        // 觸發劇烈擴張與抖動
        mainBlob.style.animation = "none"; // 先重置動畫
        setTimeout(() => {
            mainBlob.style.animation = "violent-shout 0.5s infinite alternate";
            // 讓整個畫面產生強烈震動
            document.body.style.animation = "shake 0.1s infinite";
        }, 10);
    } else {
        // 回復平靜呼吸
        mainBlob.style.animation = "breathing 4s infinite ease-in-out";
        document.body.style.animation = "none";
    }

    log.innerText = `【奇點重構】：${vals.p} 的能量已注入！`;
    log.style.color = `hsl(${h}, 100%, 80%)`;
}
