
const words = ["公園", "老師", "蘋果", "跑步", "快樂", "操場", "森林", "鑰匙", "朋友", "學習", "遊戲", "音樂", "畫畫", "跳繩", "游泳", "禮物", "蛋糕", "星星", "月亮", "太陽", "海洋", "雨傘", "小貓", "小狗"];
const players = [
    { pos: 0, color: '#e53e3e', score: 0 },
    { pos: 0, color: '#3182ce', score: 0 },
    { pos: 0, color: '#38a169', score: 0 },
    { pos: 0, color: '#d69e2e', score: 0 }
];
let turn = 0;
let timerInterval;
const bgMusic = document.getElementById('bgMusic');

// 初始化棋盤
const board = document.getElementById('board');
for (let i = 0; i < 24; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.innerText = words[i];
    board.appendChild(cell);
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
window.onload = () => { updatePos(); bgMusic.play().catch(() => {}); };

function rollDice() {
    const steps = Math.floor(Math.random() * 3) + 1;
    document.getElementById('dice-result').innerText = `🎲 玩家 ${turn + 1} 擲出了 ${steps} 步！`;
    players[turn].pos = (players[turn].pos + steps) % 24;
    updatePos();
    setTimeout(() => showModal(words[players[turn].pos]), 600);
}

function showModal(word) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-text').innerText = word;
    document.getElementById('ai-sentence-text').innerText = `這是一個關於「${word}」的句子。`; 
    modal.style.display = 'block';
    startTimer();
}

// --- 語音功能區域 ---

function speakWord() {
    if (bgMusic) bgMusic.pause();
    window.speechSynthesis.cancel();
    const text = document.getElementById('modal-text').innerText;
    if (text && text !== "詞語") {
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'zh-HK';
        msg.rate = 0.9;
        window.speechSynthesis.speak(msg);
    }
}

function speakSentence() {
    if (bgMusic) bgMusic.pause();
    window.speechSynthesis.cancel();
    const text = document.getElementById('ai-sentence-text').innerText;
    if (text) {
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = 'zh-HK';
        msg.rate = 0.9;
        window.speechSynthesis.speak(msg);
    }
}

function startRecognition() {
    if (bgMusic) bgMusic.pause();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("瀏覽器不支援語音識別");

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-HK';
    const originalWord = document.getElementById('modal-text').innerText;

    recognition.start();
    recognition.onresult = (event) => {
        const result = event.results[0][0].transcript;
        if (result.includes(originalWord)) {
            players[turn].score += 5;
            document.getElementById('s' + (turn + 1)).innerText = players[turn].score;
            closeModal(true);
        }
    };
}

// --- 輔助功能 ---

function startTimer() {
    let timeLeft = 120;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = `⏳ 剩餘時間: ${timeLeft}s`;
        if (timeLeft <= 0) closeModal(false);
    }, 1000);
}

function closeModal(isCompleted) {
    clearInterval(timerInterval);
    document.getElementById('modal').style.display = 'none';
    if (bgMusic) bgMusic.play();
    turn = (turn + 1) % 4;
}
