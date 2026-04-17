const storyStarters = {
    "公園": "今天天氣很好，我走進公園，突然看到一個會說話的長椅...",
    "老師": "在學校的走廊，我遇到一位穿著古裝的神祕老師...",
    "蘋果": "我在桌上發現一個閃著金光的蘋果，剛咬一口...",
    "跑步": "我正在操場跑步，跑著跑著，腳下竟然長出了一對小翅膀...",
    "森林": "這片森林很奇怪，樹木的葉子都是紫色的，而且...",
    "鑰匙": "這把銀色的鑰匙，竟然能打開校園裡那扇神祕的暗門...",
    "小貓": "我家的小貓今天突然站了起來，對我說了第一句話...",
};

const words = ["公園", "老師", "蘋果", "跑步", "快樂", "操場", "森林", "鑰匙", "朋友", "學習", "遊戲", "音樂", "畫畫", "跳繩", "游泳", "禮物", "蛋糕", "星星", "月亮", "太陽", "海洋", "雨傘", "小貓", "小狗"];

const players = [
    { pos: 0, color: '#e53e3e', score: 0 }
];

let turn = 0;
let timerInterval;
const bgMusic = document.getElementById('bgMusic');

// --- 初始化棋盤 ---
const board = document.getElementById('board');
if (board) {
    board.innerHTML = ''; // 清空
    for (let i = 0; i < 24; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.innerText = words[i];
        board.appendChild(cell);
    }
}

const pNodes = players.map(p => {
    const n = document.createElement('div');
    n.className = 'player';
    n.style.background = p.color;
    document.body.appendChild(n);
    return n;
});

function updatePos() {
    pNodes.forEach((n, i) => {
        const cell = board.children[players[i].pos];
        const rect = cell.getBoundingClientRect();
        n.style.left = (rect.left + window.scrollX + 10 + i * 10) + 'px';
        n.style.top = (rect.top + window.scrollY + 10) + 'px';
    });
}

window.onload = () => { 
    updatePos(); 
    if (bgMusic) bgMusic.play().catch(() => {}); 
};

function rollDice() {
    const steps = Math.floor(Math.random() * 3) + 1;
    const resultEl = document.getElementById('dice-result');
    if (resultEl) resultEl.innerText = `🎲 擲出了 ${steps} 步！`;
    players[turn].pos = (players[turn].pos + steps) % 24;
    updatePos();
    setTimeout(() => showModal(words[players[turn].pos]), 600);
}

// --- 彈窗功能 ---
function showModal(word) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-text').innerText = word;
    
    const starter = storyStarters[word] || `關於「${word}」，我聽過一個很神祕的故事...`;
    
    // ✅ 重要：使用 id="current-starter" 方便稍後抓取文字
    document.getElementById('ai-sentence-text').innerHTML = 
        `<span style="color: #718096;">故事開始：</span><br><span id="current-starter">${starter}</span>`; 
    
    // 重置按鈕
    const aiBtn = document.getElementById('ai-btn');
    const doneBtn = document.getElementById('done-btn');
    if (aiBtn) {
        aiBtn.innerText = "🎤 AI 老師聽接龍創作";
        aiBtn.style.background = "#5d4037";
    }
    if (doneBtn) {
        doneBtn.innerText = "✅ 完成/跳過";
        doneBtn.style.background = "#48bb78";
    }

    modal.style.display = 'block';
    startTimer();
}

// --- 語音功能 ---
function startRecognition() {
    if (bgMusic) bgMusic.pause();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("瀏覽器不支援語音識別");

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-HK';
    const originalWord = document.getElementById('modal-text').innerText;
    const aiBtn = document.getElementById('ai-btn');

    aiBtn.innerText = "🎤 正在聽...請接龍";
    aiBtn.style.background = "#e53e3e"; 

    recognition.start();

    recognition.onresult = (event) => {
        const studentSpeech = event.results[0][0].transcript;
        
        if (studentSpeech.includes(originalWord)) {
            players[turn].score += 10;
            const scoreEl = document.getElementById('s' + (turn + 1));
            if (scoreEl) scoreEl.innerText = players[turn].score;

            const starterText = document.getElementById('current-starter').innerText;
            
            // ✅ 合併文字：不關閉彈窗
            document.getElementById('ai-sentence-text').innerHTML = 
                `<span style="color: #718096;">${starterText}</span><br>` +
                `<span style="color: #2b6cb0; font-weight: bold; font-size: 1.1em;">你的接龍：${studentSpeech}</span>`;
            
            aiBtn.innerText = "✨ 接龍成功！";
            aiBtn.style.background = "#48bb78";
            
            const doneBtn = document.getElementById('done-btn');
            if (doneBtn) {
                doneBtn.innerText = "🚀 成功了！點我下一步";
                doneBtn.style.background = "#3182ce";
            }
        } else {
            alert(`句子裡要包含「${originalWord}」喔！你說的是：「${studentSpeech}」`);
            aiBtn.innerText = "🎤 再試一次";
            aiBtn.style.background = "#5d4037";
        }
    };

    recognition.onerror = () => {
        aiBtn.innerText = "🎤 錄音失敗";
        aiBtn.style.background = "#5d4037";
    };
}

function speakWord() {
    window.speechSynthesis.cancel();
    const text = document.getElementById('modal-text').innerText;
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'zh-HK';
    window.speechSynthesis.speak(msg);
}

function speakSentence() {
    window.speechSynthesis.cancel();
    const text = document.getElementById('ai-sentence-text').innerText;
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'zh-HK';
    window.speechSynthesis.speak(msg);
}

// --- 輔助功能 ---
function startTimer() {
    let timeLeft = 120;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.innerText = `⏳ 剩餘時間: ${timeLeft}s`;
        }
        if (timeLeft <= 0) {
            closeModal(false);
        }
    }, 1000);
}

function closeModal(isCompleted) {
    clearInterval(timerInterval);
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
    if (bgMusic) bgMusic.play();
    turn = (turn + 1) % players.length;
}
