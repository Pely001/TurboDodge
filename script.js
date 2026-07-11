        // --- Elementos do DOM ---
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreEl = document.getElementById('score');
        const pauseMessageEl = document.getElementById('pauseMessage');
        const livesEl = document.getElementById('lives');
        const highScoreContainerEl = document.getElementById('highScoreContainer');
        const finalScoreEl = document.getElementById('finalScore');
        const playerNameInputEl = document.getElementById('playerNameInput');
        const saveScoreBtn = document.getElementById('saveScoreBtn');
        const rankingListEl = document.getElementById('rankingList');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const restartGameBtn = document.getElementById('restartGameBtn');
        const saveRecordSectionEl = document.getElementById('saveRecordSection');
        const mainMenuEl = document.getElementById('mainMenu');
        const startGameBtn = document.getElementById('startGameBtn');
        const viewRankingBtn = document.getElementById('viewRankingBtn');
        const backToMenuBtn = document.getElementById('backToMenuBtn');
        const uiContainerEl = document.getElementById('uiContainer'); // Referência para o uiContainer

        // --- Variáveis de Carregamento de Imagens ---
        let assetsLoaded = 0;
        const totalAssetsToLoad = 4; // 1 player + 3 inimigos

        function assetLoaded() {
            assetsLoaded++;
            if (assetsLoaded === totalAssetsToLoad) {
                showMainMenu();
            }
        }

        const playerCarImg = new Image();
        playerCarImg.onload = assetLoaded;
        playerCarImg.src = 'images/player_new.png';

        const enemyCarImages = [];
        for (let i = 1; i <= 3; i++) {
            const img = new Image();
            img.onload = assetLoaded;
            img.src = `images/enemy_new_${i}.png`;
            enemyCarImages.push(img);
        }

        // --- Variáveis de Áudio ---
        const collisionSound = new Audio('./audio/collision.ogg');
        const backgroundMusic = new Audio('./audio/background_music.ogg');
        backgroundMusic.loop = true;
        backgroundMusic.volume = 0.5;
        collisionSound.volume = 0.7;

        let musicPlaying = false;

        // --- Variáveis de Estado do Jogo ---
        let player, enemies, score, gameOver, enemySpeed, keys = {}, roadLines;
        let isPaused = false;
        let spawnTimer = 0;
        let spawnInterval = 100;
        let scoreMultiplier = 1;
        let particles = [];
        let backgroundOffset = 0;

        // --- Variáveis para Dificuldade Dinâmica ---
        const INITIAL_ENEMY_SPEED = 5;
        const SPEED_INCREASE_RATE_EARLY = 0.005; // Reduzido de 0.007
        const SPEED_INCREASE_RATE_LATE = 0.001;  // Reduzido de 0.002
        const SPEED_CHANGE_POINT = 75;

        const INITIAL_SPAWN_INTERVAL = 70;
        const SPAWN_DECREASE_RATE_EARLY = 1.2;
        const SPAWN_DECREASE_RATE_LATE = 0.7;
        const SPAWN_CHANGE_POINT = 60;
        const MIN_SPAWN_INTERVAL = 15;
        const MIN_SPAWN_INTERVAL_HARD = 8; 

        const CAR_MIN_DRAW_SIZE = 80;
        const CAR_MAX_DRAW_SIZE = 120;

        // --- Variáveis para o Aumento de Carros na Tela ---
        const ENEMIES_AT_START = 1;
        const MAX_ENEMIES_TO_SPAWN_PER_INTERVAL = 3; 
        const TOTAL_MAX_ENEMIES_ON_SCREEN = 7; 

        const SCORE_FOR_2_CARS_CHANCE = 30;
        const SCORE_FOR_FORCED_DODGE = 80;
        const SCORE_FOR_3_CARS_CHANCE = 150;
        const SCORE_FOR_HARDER_FORCED_DODGE = 250; 
        const SCORE_FOR_CONSTANT_SPAWN_INCREASE = 300; 

        // Tolerância Y para sobreposição no spawn: Se um carro já existe X pixels acima, não spawne
        const SPAWN_OVERLAP_TOLERANCE_Y = 100; 

        // --- Dimensões
        const CAR_MAX_DRAW_WIDTH = 70;
        const CAR_MIN_DRAW_WIDTH = 45;
        const CAR_PLAYER_DRAW_WIDTH = 55;

        // Variável de Debug para desenhar hitboxes
        const DEBUG_HITBOX = false;

        // --- Constantes das Linhas da Pista ---
        const LINE_WIDTH = 10;
        const LINE_HEIGHT = 80;
        const LINE_SPACING = 50;
        const TOTAL_LINE_SEGMENT = LINE_HEIGHT + LINE_SPACING;

        // Constante para o número de posições no ranking
        const RANKING_SIZE = 3;

        // (Legacy touch handlers removed)

        function checkOverlap(car1, car2, yTolerance) {
            const car1X1 = car1.x + car1.offsetX;
            const car1Y1 = car1.y + car1.offsetY;
            const car1X2 = car1X1 + car1.collisionWidth;
            const car1Y2 = car1Y1 + car1.collisionHeight;

            const car2X1 = car2.x + car2.offsetX;
            const car2Y1 = car2.y + car2.offsetY;
            const car2X2 = car2X1 + car2.collisionWidth;
            const car2Y2 = car2Y1 + car2.collisionHeight;

            if (car1Y1 > car2Y2 || car2Y1 > car1Y2 + yTolerance) {
                return false;
            }

            return car1X1 < car2X2 && car1X2 > car2X1;
        }

        function init() {
            hideAllScreens();
            canvas.style.display = 'block';
            uiContainerEl.style.display = 'block'; // Garante que o placar esteja visível

            // Recalcula proporções do player baseado na imagem real
            const aspectRatio = playerCarImg.height / playerCarImg.width;
            const drawHeight = CAR_PLAYER_DRAW_WIDTH * aspectRatio;

            player = {
                x: canvas.width / 2 - CAR_PLAYER_DRAW_WIDTH / 2,
                y: canvas.height - drawHeight - 20,
                speedX: 0,
                drawWidth: CAR_PLAYER_DRAW_WIDTH,
                drawHeight: drawHeight,
                collisionWidth: CAR_PLAYER_DRAW_WIDTH * 0.8, // Hitbox 80% do carro (perdoável)
                collisionHeight: drawHeight * 0.8,
                offsetX: (CAR_PLAYER_DRAW_WIDTH - CAR_PLAYER_DRAW_WIDTH * 0.8) / 2,
                offsetY: (drawHeight - drawHeight * 0.8) / 2,
                rotation: 0
            };
            enemies = [];
            items = []; // Para power-ups
            score = 0;
            lives = 3;
            isInvincible = false;
            invincibilityTimer = 0;
            window.slowMotionTimer = 0; // Usando global
            gameOver = false;
            isPaused = false;
            enemySpeed = INITIAL_ENEMY_SPEED;
            keys = {}; 
            roadLines = [];
            spawnTimer = 0;
            spawnInterval = INITIAL_SPAWN_INTERVAL;
            initRoadLines();
            updateScore();
            updateLives();

            const playerLane = Math.floor((player.x + player.drawWidth / 2) / (canvas.width / 3));
            let firstEnemyLane = playerLane;
            if (Math.random() < 0.5 && playerLane !== 1) {
                firstEnemyLane = (playerLane + 1) % 3;
                if (Math.random() < 0.5) firstEnemyLane = (playerLane + 2) % 3;
            } else if (playerLane === 1) {
                 firstEnemyLane = Math.random() < 0.5 ? 0 : 2;
            }

            const initialEnemyX = calculateLaneSpawnX(firstEnemyLane, CAR_MAX_DRAW_WIDTH);
            const initialEnemyY = -canvas.height * 0.3;
            createEnemy(initialEnemyX, initialEnemyY);

            if (!isPaused && !gameOver) {
                requestAnimationFrame(gameLoop);
            }
        }

        window.addEventListener('keydown', e => {
            if (e.code === 'KeyP') {
                togglePause();
            } else if (e.code === 'Escape') {
                e.preventDefault();
            }
            if (e.code === 'ArrowLeft') keys['ArrowLeft'] = true;
            if (e.code === 'ArrowRight') keys['ArrowRight'] = true;
        });
        window.addEventListener('keyup', e => {
            if (e.code === 'ArrowLeft') keys['ArrowLeft'] = false;
            if (e.code === 'ArrowRight') keys['ArrowRight'] = false;
        });

        // --- Controles Touch para Mobile ---
        function handleTouchEvent(e) {
            // Só gerencia o toque e bloqueia scroll se o jogo estiver rodando ativamente
            if (canvas.style.display === 'none' || isPaused || gameOver) {
                return;
            }
            
            e.preventDefault();

            let leftPressed = false;
            let rightPressed = false;
            const midX = window.innerWidth / 2;

            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                if (touch.clientX < midX) {
                    leftPressed = true;
                } else {
                    rightPressed = true;
                }
            }

            keys['ArrowLeft'] = leftPressed;
            keys['ArrowRight'] = rightPressed;
        }

        window.addEventListener('touchstart', handleTouchEvent, { passive: false });
        window.addEventListener('touchmove', handleTouchEvent, { passive: false });
        window.addEventListener('touchend', handleTouchEvent, { passive: false });
        window.addEventListener('touchcancel', handleTouchEvent, { passive: false });

        function togglePause() {
            if (gameOver) return;
            isPaused = !isPaused;
            pauseMessageEl.style.display = isPaused ? 'block' : 'none';
            if (isPaused) {
                backgroundMusic.pause();
            } else {
                backgroundMusic.play().catch(e => console.log("Erro ao retomar música:", e));
                requestAnimationFrame(gameLoop);
            }
        }

        function spawnParticles(x, y, color, amount, speedMultiplier = 1) {
            for (let i = 0; i < amount; i++) {
                particles.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 6 * speedMultiplier,
                    vy: (Math.random() - 0.5) * 6 * speedMultiplier,
                    life: 1.0,
                    decay: Math.random() * 0.03 + 0.02,
                    color: color,
                    size: Math.random() * 4 + 2
                });
            }
        }

        function update() {
            // Movimentação suave com inércia
            const accel = 0.8;
            const friction = 0.85;
            if (keys['ArrowLeft']) player.speedX -= accel;
            if (keys['ArrowRight']) player.speedX += accel;
            
            player.speedX *= friction;
            player.x += player.speedX;
            
            if (player.x < 0) { player.x = 0; player.speedX = 0; }
            if (player.x > canvas.width - player.drawWidth) { player.x = canvas.width - player.drawWidth; player.speedX = 0; }
            
            player.rotation = player.speedX * 0.05;

            if (isInvincible) {
                invincibilityTimer--;
                if (invincibilityTimer <= 0) isInvincible = false;
            }
            
            if (window.slowMotionTimer > 0) {
                window.slowMotionTimer--;
            }

            // --- Lógica de Dificuldade Dinâmica: Aumento da Velocidade ---
            if (score < SPEED_CHANGE_POINT) {
                enemySpeed += SPEED_INCREASE_RATE_EARLY;
            } else {
                enemySpeed += SPEED_INCREASE_RATE_LATE;
            }

            // --- Gerar inimigos (Lógica REVISADA para spawn individual e sem sobreposição) ---
            spawnTimer++;
            if (spawnTimer >= spawnInterval) {
                let numEnemiesToAttemptSpawn = ENEMIES_AT_START;

                if (score >= SCORE_FOR_3_CARS_CHANCE) {
                    numEnemiesToAttemptSpawn = Math.floor(Math.random() * 3) + 1; 
                } else if (score >= SCORE_FOR_2_CARS_CHANCE) {
                    numEnemiesToAttemptSpawn = Math.floor(Math.random() * 2) + 1; 
                }
                
                if (score >= SCORE_FOR_CONSTANT_SPAWN_INCREASE) {
                    numEnemiesToAttemptSpawn = MAX_ENEMIES_TO_SPAWN_PER_INTERVAL; 
                }
                
                numEnemiesToAttemptSpawn = Math.min(numEnemiesToAttemptSpawn, TOTAL_MAX_ENEMIES_ON_SCREEN - enemies.length);

                const playerLane = Math.floor((player.x + player.drawWidth / 2) / (canvas.width / 3));
                let possibleLanes = [0, 1, 2];
                let lanesToBlock = []; 

                if (score >= SCORE_FOR_FORCED_DODGE && numEnemiesToAttemptSpawn > 0) {
                    if (score >= SCORE_FOR_HARDER_FORCED_DODGE || Math.random() < 0.4) { 
                        let lanesToAttempt = [0, 1, 2];
                        if (playerLane === 0) lanesToAttempt = [0, 1, 2];
                        else if (playerLane === 1) lanesToAttempt = [0, 1, 2];
                        else lanesToAttempt = [2, 1, 0]; 

                        lanesToBlock = lanesToAttempt.slice(0, Math.min(numEnemiesToAttemptSpawn, 3));

                    } else {
                        let freeLane = -1;
                        if (enemies.length > 0) { 
                            const lastEnemyLane = enemies[enemies.length - 1] ? Math.floor((enemies[enemies.length - 1].x + enemies[enemies.length - 1].drawWidth / 2) / (canvas.width / 3)) : -1;
                            if (lastEnemyLane === 0) freeLane = 1;
                            else if (lastEnemyLane === 1) freeLane = 2;
                            else freeLane = 0;
                        } else { 
                            freeLane = Math.floor(Math.random() * 3);
                        }

                        lanesToBlock = possibleLanes.filter(lane => lane !== freeLane);
                        lanesToBlock = lanesToBlock.slice(0, Math.min(numEnemiesToAttemptSpawn, 2)); 
                    }
                } else {
                    for (let i = possibleLanes.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [possibleLanes[i], possibleLanes[j]] = [possibleLanes[j], possibleLanes[i]];
                    }
                    lanesToBlock = possibleLanes.slice(0, numEnemiesToAttemptSpawn);
                }

                for (let i = 0; i < lanesToBlock.length; i++) {
                    const laneToSpawn = lanesToBlock[i];

                    let newCarX;
                    let attempts = 0;
                    const maxAttempts = 10;

                    const tempDrawWidth = CAR_MAX_DRAW_WIDTH;
                    const tempDrawHeight = CAR_MAX_DRAW_WIDTH * 2; // worst case aspect ratio

                    const tempEnemy = { 
                        y: -tempDrawHeight, 
                        drawWidth: tempDrawWidth,
                        drawHeight: tempDrawHeight,
                        collisionWidth: tempDrawWidth * 0.8, 
                        collisionHeight: tempDrawHeight * 0.8,
                        offsetX: (tempDrawWidth - tempDrawWidth * 0.8) / 2,
                        offsetY: (tempDrawHeight - tempDrawHeight * 0.8) / 2
                    };

                    let spawnedSuccessfully = false;
                    while (attempts < maxAttempts) {
                        newCarX = calculateLaneSpawnX(laneToSpawn, tempEnemy.drawWidth);
                        tempEnemy.x = newCarX;

                        let overlapDetected = false;
                        for (const existingEnemy of enemies) {
                            if (existingEnemy.y < CAR_MAX_DRAW_SIZE * 2 && existingEnemy.y > -CAR_MAX_DRAW_SIZE * 2) {
                                if (checkOverlap(tempEnemy, existingEnemy, SPAWN_OVERLAP_TOLERANCE_Y)) {
                                    overlapDetected = true;
                                    break;
                                }
                            }
                        }

                        if (!overlapDetected) {
                            createEnemy(newCarX);
                            spawnedSuccessfully = true;
                            break;
                        }
                        attempts++;
                    }
                }

                spawnTimer = 0;

                if (score < SPAWN_CHANGE_POINT) {
                    spawnInterval = Math.max(MIN_SPAWN_INTERVAL, spawnInterval - SPAWN_DECREASE_RATE_EARLY);
                } else {
                    const currentMinSpawn = (score >= SCORE_FOR_CONSTANT_SPAWN_INCREASE) ? MIN_SPAWN_INTERVAL_HARD : MIN_SPAWN_INTERVAL;
                    spawnInterval = Math.max(currentMinSpawn, spawnInterval - SPAWN_DECREASE_RATE_LATE);
                }
            }

            // Lógica de Tráfego: Carros de trás freiam se tiver um carro lento na frente
            for (let i = 0; i < enemies.length; i++) {
                let enemyA = enemies[i];
                let targetSpeedOffset = enemyA.baseSpeedOffset; // Volta ao normal se não tiver ninguém
                
                for (let j = 0; j < enemies.length; j++) {
                    if (i === j) continue;
                    let enemyB = enemies[j];
                    
                    // Se o enemyB está na frente do enemyA (y maior)
                    if (enemyB.y > enemyA.y) {
                        // Calcula a distância entre a traseira do carro A (que está atrás) e a frente do carro B (que está na frente)
                        let distance = enemyB.y - (enemyA.y + enemyA.drawHeight);
                        
                        // Se estão na mesma faixa (ou quase)
                        if (Math.abs(enemyA.x - enemyB.x) < 60) {
                            // Se a distância for menor que 80 pixels (quase batendo)
                            if (distance < 80) {
                                // Copia a velocidade do carro da frente para não bater
                                if (enemyA.speedOffset > enemyB.speedOffset) {
                                    targetSpeedOffset = enemyB.speedOffset;
                                }
                                
                                // Se por acaso já estiverem se sobrepondo (bug), empurra o carro de trás levemente para trás
                                if (distance <= 5) {
                                    enemyA.y = enemyB.y - enemyA.drawHeight - 5;
                                }
                            }
                        }
                    }
                }
                
                const effectiveEnemySpeed = window.slowMotionTimer > 0 ? enemySpeed * 0.5 : enemySpeed;
                enemyA.speedOffset = targetSpeedOffset;
                enemyA.y += Math.max(1, effectiveEnemySpeed + enemyA.speedOffset);
            }

            const playerHitboxX = player.x + player.offsetX;
            const playerHitboxY = player.y + player.offsetY;
            const playerHitboxWidth = player.collisionWidth;
            const playerHitboxHeight = player.collisionHeight;

            for (let enemy of enemies) {
                const enemyHitboxX = enemy.x + enemy.offsetX;
                const enemyHitboxY = enemy.y + enemy.offsetY;
                const enemyHitboxWidth = enemy.collisionWidth;
                const enemyHitboxHeight = enemy.collisionHeight;

                if (playerHitboxX < enemyHitboxX + enemyHitboxWidth &&
                    playerHitboxX + playerHitboxWidth > enemyHitboxX &&
                    playerHitboxY < enemyHitboxY + enemyHitboxHeight &&
                    playerHitboxY + playerHitboxHeight > enemyHitboxY) {

                    if (!isInvincible) {
                        collisionSound.currentTime = 0;
                        collisionSound.play().catch(e => console.log("Erro ao tocar som de colisão:", e));
                        
                        spawnParticles(playerHitboxX + player.collisionWidth / 2, playerHitboxY, 'rgba(255, 150, 0, 1)', 40, 2); // Explosão de faíscas

                        lives--;
                        updateLives();
                        if (lives <= 0) {
                            endGame();
                            return;
                        } else {
                            isInvincible = true;
                            invincibilityTimer = 120; // ~2 seg
                        }
                    }
                }

                // Near Miss Logic
                if (!enemy.nearMissed && playerHitboxY <= enemyHitboxY + enemyHitboxHeight && playerHitboxY + playerHitboxHeight >= enemyHitboxY) {
                    const distLeft = playerHitboxX - (enemyHitboxX + enemyHitboxWidth);
                    const distRight = enemyHitboxX - (playerHitboxX + playerHitboxWidth);
                    
                    if ((distLeft > 0 && distLeft < 25) || (distRight > 0 && distRight < 25)) {
                        enemy.nearMissed = true;
                        score += 10;
                        updateScore();
                        spawnParticles(enemy.x + enemy.drawWidth/2, enemy.y + enemy.drawHeight/2, 'rgba(0, 255, 255, 1)', 15, 1.5);
                        showFloatingText('+10 FINA!', player.x + player.drawWidth/2, player.y - 20);
                    }
                }
            }

            enemies = enemies.filter(enemy => {
                if (enemy.y > canvas.height) {
                    score += scoreMultiplier;
                    updateScore();
                    return false;
                }
                return true;
            });

            const effectiveEnemySpeed = window.slowMotionTimer > 0 ? enemySpeed * 0.5 : enemySpeed;

            // Fumaça do escapamento do jogador
            if (Math.random() < 0.4) {
                // Dois canos de escape
                spawnParticles(player.x + player.drawWidth * 0.3, player.y + player.drawHeight * 0.9, 'rgba(200, 200, 200, 0.4)', 1, 0.5);
                spawnParticles(player.x + player.drawWidth * 0.7, player.y + player.drawHeight * 0.9, 'rgba(200, 200, 200, 0.4)', 1, 0.5);
            }

            // Atualiza partículas
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy + (effectiveEnemySpeed * 0.3); // Partículas descem com a pista
                p.life -= p.decay;
            });
            particles = particles.filter(p => p.life > 0);

            // Atualiza Fundo em Parallax
            backgroundOffset += (effectiveEnemySpeed * 0.3); // Move mais lento que a pista
            if (backgroundOffset > 40) backgroundOffset = 0;

            moveRoadLines();

            // Item Spawn Logic
            if (Math.random() < 0.015) { // ~1.5% chance per frame
                spawnItem();
            }

            // Update Items
            for (let i = items.length - 1; i >= 0; i--) {
                let item = items[i];
                item.y += enemySpeed;
                
                // Collision with player
                if (playerHitboxX < item.x + item.size &&
                    playerHitboxX + playerHitboxWidth > item.x &&
                    playerHitboxY < item.y + item.size &&
                    playerHitboxY + playerHitboxHeight > item.y) {
                    
                    if (item.type === 'coin') {
                        score += 50;
                        showFloatingText('+50', player.x + player.drawWidth/2, player.y);
                    } else if (item.type === 'slow') {
                        window.slowMotionTimer = 300; // 5 segundos (assumindo ~60fps)
                        showFloatingText('SLOW!', player.x + player.drawWidth/2, player.y);
                    }
                    updateScore();
                    items.splice(i, 1);
                    continue;
                }
                
                if (item.y > canvas.height) {
                    items.splice(i, 1);
                }
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawRoadLines();
            
            if (!isInvincible || Math.floor(Date.now() / 150) % 2 === 0) {
                ctx.save();
                ctx.translate(player.x + player.drawWidth / 2, player.y + player.drawHeight / 2);
                ctx.rotate(player.rotation || 0);
                ctx.drawImage(playerCarImg, -player.drawWidth / 2, -player.drawHeight / 2, player.drawWidth, player.drawHeight);
                ctx.restore();
            }
            
            enemies.forEach(enemy => {
                ctx.save();
                ctx.translate(enemy.x + enemy.drawWidth / 2, enemy.y + enemy.drawHeight / 2);
                if (enemy.img.src.includes('enemy_new_1.png')) {
                    ctx.rotate(Math.PI);
                }
                ctx.drawImage(enemy.img, -enemy.drawWidth / 2, -enemy.drawHeight / 2, enemy.drawWidth, enemy.drawHeight);
                ctx.restore();
            });

            items.forEach(item => {
                ctx.shadowBlur = 10;
                ctx.shadowColor = item.type === 'coin' ? '#ffdd00' : '#00ffff';
                ctx.fillStyle = item.type === 'coin' ? '#ffdd00' : '#00ffff';
                ctx.beginPath();
                ctx.arc(item.x + item.size/2, item.y + item.size/2, item.size/2, 0, Math.PI*2);
                ctx.fill();
                ctx.shadowBlur = 0;
                
                ctx.fillStyle = '#000';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.type === 'coin' ? '$' : '⏱', item.x + item.size/2, item.y + item.size/2 + 2);
            });

            // Desenha partículas
            particles.forEach(p => {
                ctx.globalAlpha = Math.max(0, p.life);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1.0;

            if (typeof DEBUG_HITBOX !== 'undefined' && DEBUG_HITBOX) {
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.lineWidth = 2;
                
                // Hitbox do player
                const playerHitboxX = player.x + player.offsetX;
                const playerHitboxY = player.y + player.offsetY;
                ctx.strokeRect(playerHitboxX, playerHitboxY, player.collisionWidth, player.collisionHeight);
                
                // Hitbox dos inimigos
                enemies.forEach(enemy => {
                    ctx.strokeRect(enemy.x + enemy.offsetX, enemy.y + enemy.offsetY, enemy.collisionWidth, enemy.collisionHeight);
                });
                
                // Hitbox dos itens
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
                items.forEach(item => {
                    ctx.strokeRect(item.x, item.y, item.size, item.size);
                });
            }
        }

        function gameLoop() {
            if (gameOver) return;
            if (isPaused) return;

            update();
            draw();
            requestAnimationFrame(gameLoop);
        }

        function getRandomArrayElement(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }

        function calculateLaneSpawnX(lane, carWidth) {
            const zebraWidth = 20;
            const roadBorderOffset = 4; // yellow line width
            const leftLimit = zebraWidth + roadBorderOffset; // 24
            const rightLimit = canvas.width - zebraWidth - roadBorderOffset; // 476
            const totalLaneWidth = canvas.width / 3;

            if (lane === 0) {
                const minX = leftLimit;
                const maxX = totalLaneWidth - carWidth;
                return minX + Math.random() * (maxX - minX);
            } else if (lane === 1) {
                const minX = totalLaneWidth;
                const maxX = totalLaneWidth * 2 - carWidth;
                return minX + Math.random() * (maxX - minX);
            } else {
                const minX = totalLaneWidth * 2;
                const maxX = rightLimit - carWidth;
                return minX + Math.random() * (maxX - minX);
            }
        }

        function createEnemy(xPosition = null, yPosition = null) {
            const randomDrawWidth = Math.floor(Math.random() * (CAR_MAX_DRAW_WIDTH - CAR_MIN_DRAW_WIDTH + 1)) + CAR_MIN_DRAW_WIDTH;
            const randomEnemyImg = getRandomArrayElement(enemyCarImages);
            
            const aspectRatio = randomEnemyImg.height / randomEnemyImg.width;
            const randomDrawHeight = randomDrawWidth * aspectRatio;

            let x = xPosition !== null ? xPosition : Math.random() * (canvas.width - randomDrawWidth);
            let y = yPosition !== null ? yPosition : -randomDrawHeight;

            const enemyCollisionWidth = randomDrawWidth * 0.8; 
            const enemyCollisionHeight = randomDrawHeight * 0.8;
            const enemyOffsetX = (randomDrawWidth - enemyCollisionWidth) / 2;
            const enemyOffsetY = (randomDrawHeight - enemyCollisionHeight) / 2;
            
            // Offset de velocidade para dar vida ao trânsito (carros mais rápidos e mais devagar)
            const speedOffset = (Math.random() * 3) - 1.5; // Variação de -1.5 a +1.5

            enemies.push({
                x: x,
                y: y,
                drawWidth: randomDrawWidth,
                drawHeight: randomDrawHeight,
                collisionWidth: enemyCollisionWidth,
                collisionHeight: enemyCollisionHeight,
                offsetX: enemyOffsetX,
                offsetY: enemyOffsetY,
                speedOffset: speedOffset,
                baseSpeedOffset: speedOffset,
                img: randomEnemyImg
            });
        }

        function initRoadLines() {
            roadLines = [];
            const segmentHeight = 40; // Altura de cada segmento da zebra/faixa
            const numSegments = Math.ceil(canvas.height / segmentHeight) + 2;

            for (let i = 0; i < numSegments; i++) {
                roadLines.push({
                    y: i * segmentHeight,
                    height: segmentHeight
                });
            }
        }

        function moveRoadLines() {
            const segmentHeight = 40;
            const effectiveEnemySpeed = window.slowMotionTimer > 0 ? enemySpeed * 0.5 : enemySpeed;
            roadLines.forEach(line => {
                line.y += effectiveEnemySpeed;
                if (line.y > canvas.height) {
                    line.y -= (segmentHeight * roadLines.length);
                }
            });
        }

        function drawRoadLines() {
            // Fundo Synthwave Grid
            ctx.fillStyle = '#110022'; // Fundo roxo bem escuro
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)'; // Grade neon ciano
            ctx.lineWidth = 1;
            const gridSpacing = 40;
            
            // Linhas verticais da grade
            for (let x = 0; x < canvas.width; x += gridSpacing) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            
            // Linhas horizontais móveis (Parallax)
            for (let y = backgroundOffset - gridSpacing; y < canvas.height; y += gridSpacing) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            // Asfalto (Levemente transparente para ver o grid passando por baixo)
            ctx.fillStyle = 'rgba(44, 44, 52, 0.85)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Zebras laterais e faixas centrais
            const zebraWidth = 20;
            
            roadLines.forEach((line, index) => {
                // Alterna as cores baseado no índice para dar o efeito de zebra
                const isRed = index % 2 === 0;
                
                // Zebras na Esquerda
                ctx.fillStyle = isRed ? '#ff2a2a' : '#ffffff';
                ctx.fillRect(0, line.y, zebraWidth, line.height);
                
                // Zebras na Direita
                ctx.fillStyle = isRed ? '#ff2a2a' : '#ffffff';
                ctx.fillRect(canvas.width - zebraWidth, line.y, zebraWidth, line.height);

                // Faixas centrais (brancas e tracejadas)
                if (isRed) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                    const laneWidth = 10;
                    ctx.fillRect(canvas.width / 3 - laneWidth / 2, line.y, laneWidth, line.height);
                    ctx.fillRect((canvas.width / 3) * 2 - laneWidth / 2, line.y, laneWidth, line.height);
                }
            });
            
            // Desenhar linhas contínuas para separar o acostamento (zebra) da pista
            ctx.fillStyle = '#ffcc00'; // Linha amarela contínua
            ctx.fillRect(zebraWidth, 0, 4, canvas.height);
            ctx.fillRect(canvas.width - zebraWidth - 4, 0, 4, canvas.height);
        }

        function updateScore() {
            scoreEl.textContent = score;
        }

        function updateLives() {
            livesEl.textContent = '❤️'.repeat(lives);
        }

        function showFloatingText(text, x, y) {
            const el = document.createElement('div');
            el.className = 'floating-text';
            el.textContent = text;
            
            // Adjust coordinates relative to UI container if needed, but since uiContainer is same size/position as canvas, we can use absolute positions.
            const canvasRect = canvas.getBoundingClientRect();
            // Actually, uiContainer is position:absolute over canvas. 
            // So x, y from canvas perfectly maps to uiContainer coords.
            el.style.left = (x - 20) + 'px'; 
            el.style.top = y + 'px';
            
            uiContainerEl.appendChild(el);
            setTimeout(() => el.remove(), 1000);
        }

        function spawnItem() {
            if (items.length > 2) return;
            const laneToSpawn = Math.floor(Math.random() * 3);
            const size = 30;
            const x = laneToSpawn * (canvas.width / 3) + (canvas.width/3 - size)/2;
            const y = -size;
            
            // Verifica se tem algum carro muito perto nessa posição e aborta se sim
            for (const enemy of enemies) {
                if (Math.abs(enemy.x - x) < 100 && enemy.y < size * 2 && enemy.y > -150) {
                    return; // Há um carro nascendo ou passando pela área de spawn, melhor não criar o item.
                }
            }

            const type = Math.random() < 0.8 ? 'coin' : 'slow';
            items.push({ x: x, y: y, size: size, type: type });
        }

        function isMobileDevice() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0);
        }

        function hideAllScreens() {
            mainMenuEl.style.display = 'none';
            highScoreContainerEl.style.display = 'none';
            canvas.style.display = 'none';
            pauseMessageEl.style.display = 'none';
            saveRecordSectionEl.style.display = 'none';
            uiContainerEl.style.display = 'none'; 
        }

        function showMainMenu() {
            hideAllScreens();
            mainMenuEl.style.display = 'block';
            displayHighScores();
        }

        function showRankingScreen() {
            hideAllScreens();
            highScoreContainerEl.style.display = 'block';
            saveRecordSectionEl.style.display = 'none';
            highScoreContainerEl.querySelector('h2').textContent = 'Ranking';
            finalScoreEl.parentElement.style.display = 'none';
            restartGameBtn.style.display = 'none';
            backToMenuBtn.style.display = 'block';
            displayHighScores();
        }

        function showGameOverScreen() {
            hideAllScreens();
            highScoreContainerEl.style.display = 'block';
            finalScoreEl.textContent = score;
            finalScoreEl.parentElement.style.display = 'block';
            restartGameBtn.style.display = 'block';
            backToMenuBtn.style.display = 'block';

            highScoreContainerEl.querySelector('h2').textContent = 'Fim de Jogo!';
            displayHighScores();
            checkIfNewHighScore();
        }

        function endGame() {
            gameOver = true;
            backgroundMusic.pause();
            backgroundMusic.currentTime = 0;
            musicPlaying = false;

            showGameOverScreen();
        }

        function getHighScores() {
            const scores = localStorage.getItem('carGameHighScores');
            return scores ? JSON.parse(scores) : [];
        }

        function saveHighScore() {
            const playerName = playerNameInputEl.value.trim() || 'Anônimo';
            const highScores = getHighScores();

            highScores.push({ name: playerName, score: score });
            highScores.sort((a, b) => b.score - a.score);
            highScores.splice(RANKING_SIZE);

            localStorage.setItem('carGameHighScores', JSON.stringify(highScores));

            playerNameInputEl.value = '';
            saveRecordSectionEl.style.display = 'none';
            displayHighScores();
        }

        function displayHighScores() {
            const highScores = getHighScores();
            rankingListEl.innerHTML = highScores
                .map((item, index) => `<li>${index + 1}. ${item.name} - ${item.score}</li>`)
                .join('');
        }

        function checkIfNewHighScore() {
            const highScores = getHighScores();
            if (highScores.length < RANKING_SIZE || score > (highScores.length > 0 ? highScores.slice(-1)[0].score : 0)) {
                saveRecordSectionEl.style.display = 'block';
                playerNameInputEl.focus();
            } else {
                saveRecordSectionEl.style.display = 'none';
            }
        }

        startGameBtn.addEventListener('click', () => {
            if (!musicPlaying) {
                backgroundMusic.play().then(() => {
                    musicPlaying = true;
                    console.log("Música iniciada pelo clique em 'Iniciar Jogo'.");
                }).catch(e => {
                    console.error("Erro ao iniciar música pelo clique:", e);
                });
            }
            init();
        });

        viewRankingBtn.addEventListener('click', showRankingScreen);

        restartGameBtn.addEventListener('click', () => {
            if (!musicPlaying) {
                backgroundMusic.play().then(() => {
                    musicPlaying = true;
                    console.log("Música iniciada pelo clique em 'Reiniciar Jogo'.");
                }).catch(e => {
                    console.error("Erro ao iniciar música pelo clique em reiniciar:", e);
                });
            }
            init();
        });

        saveScoreBtn.addEventListener('click', saveHighScore);
        playerNameInputEl.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') saveHighScore();
        });
        backToMenuBtn.addEventListener('click', showMainMenu);
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        
        function toggleFullscreen() {
            const elem = document.documentElement;
            if (!document.fullscreenElement) {
                if (elem.requestFullscreen) {
                    elem.requestFullscreen();
                } else if (elem.mozRequestFullScreen) {
                    elem.mozRequestFullScreen();
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen();
                } else if (elem.msRequestFullscreen) {
                    elem.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (elem.webkitExitFullscreen) {
                    elem.webkitExitFullscreen();
                } else if (elem.msExitFullscreen) {
                    elem.msExitFullscreen();
                }
            }
        }
