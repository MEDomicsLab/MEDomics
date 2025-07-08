import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';

const FederatedLearningAnimation = () => {
  const [phase, setPhase] = useState('training');
  const [trainingProgress, setTrainingProgress] = useState([0, 0, 0]);
  const [particles, setParticles] = useState([]);
  const [cycle, setCycle] = useState(0);
  const cycleRef = useRef(0);

  // Client positions (relative to the server)
  const clientPositions = [
    { id: 'client1', x: -150, y: -100 },
    { id: 'client2', x: 150, y: -100 },
    { id: 'client3', x: 0, y: 100 },
  ];

  // Animation sequence controller
  useEffect(() => {
    const controller = {
      training: () => {
        // Simulate training progress
        setTrainingProgress(prev => {
          const newProgress = prev.map(p => Math.min(100, p + 1.5));
          if (newProgress.every(p => p >= 100)) {
            setTimeout(() => setPhase('sending'), 500);
          }
          return newProgress;
        });
      },
      sending: () => {
        // Create particles moving from clients to server
        if (particles.length === 0) {
          const newParticles = clientPositions.map((client, index) => ({
            id: `${cycleRef.current}-to-server-${index}`,
            type: 'model-update',
            from: client.id,
            to: 'server',
            progress: 0,
            color: `hsl(${index * 120}, 80%, 60%)`,
          }));
          setParticles(newParticles);
        }
        
        // Move particles toward server
        setParticles(prev => {
          const updated = prev.map(p => ({ ...p, progress: Math.min(100, p.progress + 1.5) }));
          
          // When all particles reach the server
          if (updated.every(p => p.progress >= 100)) {
            setTimeout(() => setPhase('aggregating'), 500);
          }
          return updated;
        });
      },
      aggregating: () => {
        // Simulate server processing
        setTimeout(() => setPhase('broadcasting'), 1500);
      },
      broadcasting: () => {
        // Create particles moving from server to clients
        if (particles.length === 0) {
          const newParticles = clientPositions.map(client => ({
            id: `${cycleRef.current}-to-${client.id}`,
            type: 'global-model',
            from: 'server',
            to: client.id,
            progress: 0,
            color: '#FFD700', // Gold color for global model
          }));
          setParticles(newParticles);
        }
        
        // Move particles toward clients
        setParticles(prev => {
          const updated = prev.map(p => ({ ...p, progress: Math.min(100, p.progress + 1.5) }));
          
          // When all particles reach the clients
          if (updated.every(p => p.progress >= 100)) {
            setTimeout(() => {
              setPhase('training');
              setTrainingProgress([0, 0, 0]);
              setParticles([]);
              setCycle(c => c + 1);
              cycleRef.current++;
            }, 500);
          }
          return updated;
        });
      }
    };

    const interval = setInterval(() => controller[phase](), 30);
    return () => clearInterval(interval);
  }, [phase, particles]);

  return (
    <AnimationContainer>
      <Header>Federated Learning Process</Header>
      <StatusBar>
        <StatusItem active={phase === 'training'}>Local Training</StatusItem>
        <StatusItem active={phase === 'sending'}>Sending Updates</StatusItem>
        <StatusItem active={phase === 'aggregating'}>Server Aggregation</StatusItem>
        <StatusItem active={phase === 'broadcasting'}>Broadcasting Model</StatusItem>
      </StatusBar>
      
      <AnimationArea>
        <Server>
          <ServerIcon phase={phase} />
          <ServerLabel>Global Server</ServerLabel>
          {phase === 'aggregating' && <AggregationEffect />}
        </Server>
        
        {clientPositions.map((client, index) => (
          <ClientContainer key={client.id} x={client.x} y={client.y}>
            <Client>
              <ClientIcon phase={phase} />
              <ClientLabel>{client.id}</ClientLabel>
              <ProgressRing 
                progress={trainingProgress[index]} 
                color={`hsl(${index * 120}, 80%, 60%)`}
                visible={phase === 'training'}
              />
            </Client>
          </ClientContainer>
        ))}
        
        {/* Particles moving between clients and server */}
        {particles.map(particle => (
          <Particle
            key={particle.id}
            particle={particle}
            clientPositions={clientPositions}
          />
        ))}
        
        <CycleCounter>Cycle: {cycle}</CycleCounter>
      </AnimationArea>
      
      <Legend>
        <LegendItem color="#FF6B6B">Local Training</LegendItem>
        <LegendItem color="#4ECDC4">Model Updates</LegendItem>
        <LegendItem color="#FFD700">Global Model</LegendItem>
        <LegendItem color="#FF9F1C">Aggregation</LegendItem>
      </Legend>
    </AnimationContainer>
  );
};

// Particle component for visualizing data movement
const Particle = ({ particle, clientPositions }) => {
  const { from, to, progress, color } = particle;
  
  // Determine start and end positions
  const startPos = from === 'server' ? { x: 0, y: 0 } : 
    clientPositions.find(c => c.id === from) || { x: 0, y: 0 };
  
  const endPos = to === 'server' ? { x: 0, y: 0 } : 
    clientPositions.find(c => c.id === to) || { x: 0, y: 0 };
  
  // Calculate current position
  const currentX = startPos.x + (endPos.x - startPos.x) * (progress / 100);
  const currentY = startPos.y + (endPos.y - startPos.y) * (progress / 100);
  
  return (
    <ParticleDot 
      style={{ 
        transform: `translate(${currentX}px, ${currentY}px)`,
        backgroundColor: color,
        opacity: progress > 98 ? 0 : 1 // Fade out at destination
      }} 
    />
  );
};

// Styled components
const AnimationContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background: linear-gradient(135deg, #1a2a6c, #2c3e50);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  color: white;
`;

const Header = styled.h1`
  margin: 0 0 20px;
  font-weight: 600;
  background: linear-gradient(90deg, #4ECDC4, #FFD700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-align: center;
`;

const StatusBar = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 30px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 10px;
`;

const StatusItem = styled.div`
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  font-weight: 500;
  background: ${props => props.active 
    ? 'linear-gradient(90deg, #4ECDC4, #2a9d8f)' 
    : 'transparent'};
  transition: all 0.3s ease;
  transform: ${props => props.active ? 'scale(1.05)' : 'scale(1)'};
  box-shadow: ${props => props.active ? '0 4px 10px rgba(0, 0, 0, 0.2)' : 'none'};
`;

const AnimationArea = styled.div`
  position: relative;
  width: 500px;
  height: 400px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const Server = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
`;

const ServerIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${props => 
    props.phase === 'aggregating' 
      ? 'radial-gradient(circle, #FF9F1C, #FF6B6B)'
      : 'radial-gradient(circle, #4ECDC4, #1a2a6c)'};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px ${props => 
    props.phase === 'aggregating' ? 'rgba(255, 159, 28, 0.8)' : 'rgba(78, 205, 196, 0.5)'};
  transition: all 0.5s ease;
  
  &::before {
    content: '';
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: white;
    opacity: 0.3;
  }
`;

const ServerLabel = styled.div`
  margin-top: 10px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
`;

const ClientContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(${props => props.x}px, ${props => props.y}px);
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Client = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
`;

const ClientIcon = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: radial-gradient(circle, #FF6B6B, #c44569);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 15px rgba(255, 107, 107, 0.4);
  
  &::before {
    content: '';
    position: absolute;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: white;
    opacity: 0.3;
  }
`;

const ClientLabel = styled.div`
  margin-top: 8px;
  font-weight: 500;
  background: rgba(0, 0, 0, 0.4);
  padding: 3px 10px;
  border-radius: 15px;
  font-size: 12px;
`;

const ProgressRing = styled.div`
  position: absolute;
  top: -5px;
  left: -5px;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: transparent;
  border: 3px solid rgba(255, 255, 255, 0.1);
  
  &::before {
    content: '';
    position: absolute;
    top: -3px;
    left: -3px;
    width: 70px;
    height: 70px;
    border-radius: 50%;
    border: 3px solid ${props => props.color};
    border-top-color: transparent;
    transform: rotate(${props => props.progress * 3.6}deg);
    clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
    opacity: ${props => props.visible ? 1 : 0};
    transition: opacity 0.3s ease;
  }
`;

const ParticleDot = styled.div`
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 10px currentColor;
`;

const pulse = keyframes`
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.5); opacity: 0.4; }
  100% { transform: scale(1); opacity: 0.8; }
`;

const AggregationEffect = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, transparent 50%, rgba(255, 159, 28, 0.3) 100%);
  animation: ${pulse} 1.5s infinite;
  z-index: -1;
`;

const CycleCounter = styled.div`
  position: absolute;
  bottom: 15px;
  right: 15px;
  background: rgba(0, 0, 0, 0.4);
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 14px;
`;

const Legend = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  width: 100%;
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  font-size: 14px;
  
  &::before {
    content: '';
    display: inline-block;
    width: 15px;
    height: 15px;
    border-radius: 4px;
    background: ${props => props.color};
    margin-right: 8px;
    box-shadow: 0 0 5px ${props => props.color};
  }
`;

export default FederatedLearningAnimation;