import { useCallback } from 'react';
import Particles from 'react-tsparticles';
import { loadSlim } from 'tsparticles-slim';
import type { Engine } from 'tsparticles-engine';

export default function FirefliesBackground() {

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 opacity-60">
      <Particles
        id="tsparticles-fireflies"
        init={particlesInit}
        options={{
          fullScreen: false,
          particles: {
            number: {
              value: 30,
              density: {
                enable: true,
                value_area: 800
              }
            },
            color: {
              value: ["#ffcc00", "#ff9900", "#ffff00", "#ccff00"]
            },
            shape: {
              type: "circle"
            },
            opacity: {
              value: 0.6,
              random: true,
              anim: {
                enable: true,
                speed: 0.5,
                opacity_min: 0.1,
                sync: false
              }
            },
            size: {
              value: 3,
              random: true,
              anim: {
                enable: true,
                speed: 1,
                size_min: 0.5,
                sync: false
              }
            },
            move: {
              enable: true,
              speed: 0.5,
              direction: "none",
              random: true,
              straight: false,
              out_mode: "out",
              bounce: false,
              attract: {
                enable: false
              }
            },
            glow: {
              enable: true,
              color: "#ffcc00",
              size: 10
            }
          },
          interactivity: {
            detect_on: "canvas",
            events: {
              onhover: {
                enable: false
              },
              onclick: {
                enable: false
              }
            }
          },
          retina_detect: true
        }}
      />
    </div>
  );
}
