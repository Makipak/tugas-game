import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Game constants
const BALL_SIZE = 20;
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 15;
const BRICK_WIDTH = 70;
const BRICK_HEIGHT = 30;
const BRICK_ROWS = 5;
const BRICK_COLS = 5;
const BRICK_SPACING = 5;
const BALL_SPEED = 6;
const PADDLE_SPEED = 15;

interface Brick {
  id: number;
  x: number;
  y: number;
  destroyed: boolean;
}

export default function BreakoutGame() {
  const insets = useSafeAreaInsets();
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);

  // Ball position and velocity
  const ballX = useRef(new Animated.Value(SCREEN_WIDTH / 2 - BALL_SIZE / 2)).current;
  const ballY = useRef(new Animated.Value(SCREEN_HEIGHT * 0.6)).current;
  const ballXPos = useRef(SCREEN_WIDTH / 2 - BALL_SIZE / 2);
  const ballYPos = useRef(SCREEN_HEIGHT * 0.6);
  const velocityX = useRef(BALL_SPEED);
  const velocityY = useRef(-BALL_SPEED);

  // Paddle position
  const paddleX = useRef(new Animated.Value(SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2)).current;
  const paddleXPos = useRef(SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2);

  // Bricks
  const [bricks, setBricks] = useState<Brick[]>([]);

  // Game loop ref
  const gameLoopRef = useRef<any>(null);

  // Handle touch events for paddle control
  const handleTouchStart = (evt: any) => {
    if (!gameStarted) {
      startGame();
      return;
    }
  };

  const handleTouchMove = (evt: any) => {
    if (!gameStarted || gameOver) return;
    
    // Get touch position relative to the View
    const touchX = evt.nativeEvent.locationX;
    
    if (touchX === undefined || touchX === null) return;
    
    // Center paddle on touch position
    let newX = touchX - PADDLE_WIDTH / 2;
    
    // Keep paddle within screen bounds
    newX = Math.max(0, Math.min(SCREEN_WIDTH - PADDLE_WIDTH, newX));
    
    paddleXPos.current = newX;
    paddleX.setValue(newX);
  };

  useEffect(() => {
    initializeBricks();
  }, [level]);

  const initializeBricks = () => {
    const newBricks: Brick[] = [];
    const totalBrickWidth = BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_SPACING;
    const startX = (SCREEN_WIDTH - totalBrickWidth) / 2;
    const startY = 100 + insets.top;

    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        newBricks.push({
          id: row * BRICK_COLS + col,
          x: startX + col * (BRICK_WIDTH + BRICK_SPACING),
          y: startY + row * (BRICK_HEIGHT + BRICK_SPACING),
          destroyed: false,
        });
      }
    }

    setBricks(newBricks);
  };

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    
    // Reset ball position
    const startX = SCREEN_WIDTH / 2 - BALL_SIZE / 2;
    const startY = SCREEN_HEIGHT * 0.6;
    ballXPos.current = startX;
    ballYPos.current = startY;
    ballX.setValue(startX);
    ballY.setValue(startY);
    
    // Random initial direction
    velocityX.current = (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED;
    velocityY.current = -BALL_SPEED;
    
    // Reset paddle position
    const paddleStartX = SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2;
    paddleXPos.current = paddleStartX;
    paddleX.setValue(paddleStartX);
    
    // Initialize bricks
    initializeBricks();
    
    gameLoop();
  };

  const checkCollisions = () => {
    const ballLeft = ballXPos.current;
    const ballRight = ballXPos.current + BALL_SIZE;
    const ballTop = ballYPos.current;
    const ballBottom = ballYPos.current + BALL_SIZE;

    // Collision with walls
    if (ballLeft <= 0 || ballRight >= SCREEN_WIDTH) {
      velocityX.current *= -1;
      if (ballLeft <= 0) {
        ballXPos.current = 0;
        ballX.setValue(0);
      } else {
        ballXPos.current = SCREEN_WIDTH - BALL_SIZE;
        ballX.setValue(SCREEN_WIDTH - BALL_SIZE);
      }
    }

    if (ballTop <= 0) {
      velocityY.current *= -1;
      ballYPos.current = 0;
      ballY.setValue(0);
    }

    // Collision with paddle
    const paddleLeft = paddleXPos.current;
    const paddleRight = paddleXPos.current + PADDLE_WIDTH;
    const paddleTop = SCREEN_HEIGHT - PADDLE_HEIGHT - 50 - insets.bottom;
    const paddleBottom = paddleTop + PADDLE_HEIGHT;

    if (
      ballBottom >= paddleTop &&
      ballTop <= paddleBottom &&
      ballRight > paddleLeft &&
      ballLeft < paddleRight &&
      velocityY.current > 0
    ) {
      velocityY.current *= -1;
      ballYPos.current = paddleTop - BALL_SIZE;
      ballY.setValue(paddleTop - BALL_SIZE);
      
      // Add angle based on where ball hits paddle
      const hitPosition = (ballXPos.current + BALL_SIZE / 2 - paddleLeft) / PADDLE_WIDTH;
      velocityX.current = (hitPosition - 0.5) * BALL_SPEED * 2;
    }

    // Collision with bricks
    setBricks(prev => {
      return prev.map(brick => {
        if (brick.destroyed) return brick;

        const brickLeft = brick.x;
        const brickRight = brick.x + BRICK_WIDTH;
        const brickTop = brick.y;
        const brickBottom = brick.y + BRICK_HEIGHT;

        if (
          ballRight > brickLeft &&
          ballLeft < brickRight &&
          ballBottom > brickTop &&
          ballTop < brickBottom
        ) {
          // Destroy brick
          setScore(prevScore => {
            const newScore = prevScore + 10;
            if (newScore > highScore) {
              setHighScore(newScore);
            }
            return newScore;
          });

          // Bounce ball
          const ballCenterX = ballXPos.current + BALL_SIZE / 2;
          const ballCenterY = ballYPos.current + BALL_SIZE / 2;
          const brickCenterX = brick.x + BRICK_WIDTH / 2;
          const brickCenterY = brick.y + BRICK_HEIGHT / 2;

          const dx = ballCenterX - brickCenterX;
          const dy = ballCenterY - brickCenterY;

          if (Math.abs(dx) > Math.abs(dy)) {
            velocityX.current *= -1;
          } else {
            velocityY.current *= -1;
          }

          return { ...brick, destroyed: true };
        }

        return brick;
      });
    });

    // Check if all bricks destroyed
    const remainingBricks = bricks.filter(b => !b.destroyed).length;
    if (remainingBricks === 1) { // Last brick being destroyed
      setTimeout(() => {
        const allDestroyed = bricks.every(b => b.destroyed);
        if (allDestroyed) {
          // Next level
          setLevel(prev => prev + 1);
          startGame();
        }
      }, 100);
    }

    // Game over if ball falls below paddle
    if (ballTop > SCREEN_HEIGHT) {
      setGameOver(true);
      setGameStarted(false);
    }
  };

  const gameLoop = () => {
    if (gameOver) return;

    const update = () => {
      if (!gameStarted || gameOver) return;

      // Update ball position
      ballXPos.current += velocityX.current;
      ballYPos.current += velocityY.current;

      ballX.setValue(ballXPos.current);
      ballY.setValue(ballYPos.current);

      // Check collisions
      checkCollisions();

      // Continue game loop
      gameLoopRef.current = requestAnimationFrame(update);
    };

    gameLoopRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoop();
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameOver, bricks]);

  const renderBricks = () => {
    return bricks.map((brick) => {
      if (brick.destroyed) return null;

      return (
        <View
          key={brick.id}
          style={[
            styles.brick,
            {
              left: brick.x,
              top: brick.y,
              backgroundColor: getBrickColor(brick.id),
            },
          ]}
        />
      );
    });
  };

  const getBrickColor = (id: number): string => {
    const row = Math.floor(id / BRICK_COLS);
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'];
    return colors[row % colors.length];
  };

  return (
    <View 
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <StatusBar style="light" />
      
      {/* Score Display */}
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreText}>Skor: {score}</Text>
        <Text style={styles.highScoreText}>Skor Tertinggi: {highScore}</Text>
        <Text style={styles.levelText}>Level: {level}</Text>
      </View>

      {/* Game Area */}
      <View 
        style={styles.gameArea}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {/* Bricks */}
        {renderBricks()}

        {/* Ball */}
        <Animated.View
          style={[
            styles.ball,
            {
              left: ballX,
              top: ballY,
            },
          ]}
        />

        {/* Paddle */}
        <Animated.View
          style={[
            styles.paddle,
            {
              left: paddleX,
              bottom: 50 + insets.bottom,
            },
          ]}
        />
      </View>

      {/* Start/Game Over Overlay */}
      {!gameStarted && (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.overlayContent} pointerEvents="auto">
            {gameOver ? (
              <>
                <Text style={styles.overlayTitle}>Permainan Berakhir!</Text>
                <Text style={styles.overlayScore}>Skor: {score}</Text>
                <Text style={styles.overlayText}>Ketuk untuk bermain lagi</Text>
              </>
            ) : (
              <>
                <Text style={styles.overlayTitle}>Breakout</Text>
                <Text style={styles.overlayText}>Ketuk untuk mulai!</Text>
                <Text style={styles.instructionsText}>
                  Geser untuk menggerakkan papan{'\n'}
                  Hancurkan semua bata!{'\n'}
                  Jangan biarkan bola jatuh!
                </Text>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scoreContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  highScoreText: {
    fontSize: 14,
    color: '#fff',
    marginTop: 4,
  },
  levelText: {
    fontSize: 14,
    color: '#fff',
    marginTop: 4,
  },
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  ball: {
    position: 'absolute',
    width: BALL_SIZE,
    height: BALL_SIZE,
    backgroundColor: '#fff',
    borderRadius: BALL_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  paddle: {
    position: 'absolute',
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    backgroundColor: '#4ecdc4',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  brick: {
    position: 'absolute',
    width: BRICK_WIDTH,
    height: BRICK_HEIGHT,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  overlayContent: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 250,
  },
  overlayTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 10,
  },
  overlayScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  overlayText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  instructionsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 20,
  },
});
