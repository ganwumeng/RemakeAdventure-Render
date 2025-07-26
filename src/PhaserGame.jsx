import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import StartGame from './game/main';
import { EventBus } from './game/EventBus';

export const PhaserGame = forwardRef(function PhaserGame ({ currentActiveScene }, ref)
{
    const game = useRef();

    // Create the game inside a useLayoutEffect hook to avoid the game being created outside the DOM
    useLayoutEffect(() => {
        
        if (game.current === undefined)
        {
            game.current = StartGame("game-container");
            
            if (ref !== null)
            {
                ref.current = { game: game.current, scene: null };
            }

            // Handle window resize
            const handleResize = () => {
                if (game.current) {
                    game.current.scale.resize(window.innerWidth, window.innerHeight);
                }
            };

            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
            };
        }

        return () => {

            if (game.current)
            {
                game.current.destroy(true);
                game.current = undefined;
            }

        }
    }, [ref]);

    useEffect(() => {

        EventBus.on('current-scene-ready', (currentScene) => {
            console.log("PhaserGame: 场景准备就绪", currentScene.scene?.key);
            
            if (currentActiveScene instanceof Function)
            {
                currentActiveScene(currentScene);
            }
            ref.current.scene = currentScene;
            console.log("PhaserGame: 已更新ref.current.scene到", currentScene.scene?.key);
        });

        return () => {

            EventBus.off('current-scene-ready');

        }
        
    }, [currentActiveScene, ref])

    return (
        <div id="game-container"></div>
    );

});
