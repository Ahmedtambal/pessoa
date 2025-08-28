import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Plane } from '@react-three/drei';
import * as THREE from 'three';

// This component represents a single floating plane
const FloatingCard = ({ position, rotation, scale }) => {
  const meshRef = useRef<THREE.Mesh>(null!);

  // useFrame runs on every rendered frame
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // Simple harmonic motion for a gentle float
    meshRef.current.position.y = position[1] + Math.sin(time + position[0]) * 0.1;
    meshRef.current.rotation.x += 0.001;
    meshRef.current.rotation.y += 0.002;
  });

  return (
    <Plane ref={meshRef} args={[1, 1.5]} position={position} rotation={rotation} scale={scale}>
      {/* The material defines the appearance. We make it semi-transparent glass. */}
      <meshStandardMaterial 
        color="#ffffff" 
        transparent 
        opacity={0.1} 
        metalness={0.9} 
        roughness={0.1} 
        side={THREE.DoubleSide}
      />
    </Plane>
  );
};

// This component sets up the scene and renders multiple cards
const Scene = () => {
    // We use useMemo to ensure the random positions are calculated only once
    const cards = useMemo(() => {
        return Array.from({ length: 30 }).map(() => ({
            position: [
                THREE.MathUtils.randFloatSpread(15), // x
                THREE.MathUtils.randFloatSpread(15), // y
                THREE.MathUtils.randFloatSpread(10) - 5, // z
            ],
            rotation: [
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI,
            ],
            scale: THREE.MathUtils.randFloat(0.5, 1.2),
        }));
    }, []);

    return (
        <>
            {/* Ambient light provides a soft, general illumination */}
            <ambientLight intensity={0.5} />
            {/* Point light creates highlights and is colored with our primary orange */}
            <pointLight position={[-5, 5, 5]} intensity={150} color="#FF6B00" />
            <pointLight position={[5, -5, -5]} intensity={50} color="#1A202C" />

            {/* Map over our array of random data to render each card */}
            {cards.map((card, i) => (
                <FloatingCard key={i} {...card} />
            ))}
        </>
    );
};


const AnimatedBackground: React.FC = () => {
  return (
    <div className="background-canvas">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <Scene />
      </Canvas>
    </div>
  );
};

export default AnimatedBackground;