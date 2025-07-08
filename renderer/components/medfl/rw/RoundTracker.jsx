import React, { useState } from 'react';
import { Accordion, Table, Badge } from 'react-bootstrap';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

const RoundTracker = ({ clientEvalMetrics, roundResults }) => {
  const [activeRound, setActiveRound] = useState(null);

  // Create round data structure
  const getRoundData = () => {
    const rounds = {};
    
    // Add aggregation results
    roundResults.forEach(result => {
      rounds[result.round] = {
        aggregation: result,
        clients: []
      };
    });
    
    // Add client metrics
    clientEvalMetrics.forEach(client => {
      if (!rounds[client.round]) {
        rounds[client.round] = {
          aggregation: null,
          clients: []
        };
      }
      rounds[client.round].clients.push(client);
    });
    
    return Object.entries(rounds)
      .map(([round, data]) => ({
        round: parseInt(round),
        ...data
      }))
      .sort((a, b) => b.round - a.round); // Latest rounds first
  };

  const roundData = getRoundData();
  
  const toggleRound = (round) => {
    setActiveRound(activeRound === round ? null : round);
  };

  return (
    <div className="round-tracker">
      <h3 className="mb-4">Training Rounds Performance</h3>
      
      {roundData.length === 0 ? (
        <div className="text-center p-4 text-muted">
          No round data available yet
        </div>
      ) : (
        roundData.map(({ round, aggregation, clients }) => (
          <div key={round} className="round-card mb-3 border rounded">
            <div 
              className="round-header p-3 d-flex justify-content-between align-items-center cursor-pointer"
              onClick={() => toggleRound(round)}
            >
              <div className="d-flex align-items-center">
                <h5 className="mb-0">
                  Round {round} - 
                  {aggregation ? (
                    <>
                      <Badge bg="success" className="ms-2">
                        Completed
                      </Badge>
                      <span className="ms-3">
                        Loss: {aggregation.loss.toFixed(4)} | 
                        Accuracy: {(aggregation.accuracy * 100).toFixed(2)}% | 
                        AUC: {aggregation.auc.toFixed(4)}
                      </span>
                    </>
                  ) : (
                    <Badge bg="warning" className="ms-2">
                      In Progress ({clients.length} clients reported)
                    </Badge>
                  )}
                </h5>
              </div>
              <div>
                {activeRound === round ? <FaChevronUp /> : <FaChevronDown />}
              </div>
            </div>
            
            {activeRound === round && (
              <div className="client-results p-3 bg-light">
                <h6 className="mb-3">Client Evaluation Metrics:</h6>
                <div className="table-responsive">
                  <Table striped bordered size="sm">
                    <thead>
                      <tr>
                        <th>Client ID</th>
                        <th>Loss</th>
                        <th>Accuracy</th>
                        <th>AUC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.length > 0 ? clients.map(client => (
                        <tr key={`${round}-${client.clientId}`}>
                          <td className="font-monospace">{client.clientId.substring(0, 8)}</td>
                          <td>{client.loss.toFixed(4)}</td>
                          <td>{(client.accuracy * 100).toFixed(2)}%</td>
                          <td>{client.auc.toFixed(4)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="4" className="text-center text-muted py-3">
                            No client metrics available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
                
                {aggregation && (
                  <div className="aggregation-summary mt-3 p-3 bg-white border rounded">
                    <h6>Aggregation Results:</h6>
                    <div className="d-flex flex-wrap gap-4">
                      <div>
                        <strong>Loss:</strong> {aggregation.loss.toFixed(4)}
                      </div>
                      <div>
                        <strong>Accuracy:</strong> {(aggregation.accuracy * 100).toFixed(2)}%
                      </div>
                      <div>
                        <strong>AUC:</strong> {aggregation.auc.toFixed(4)}
                      </div>
                      <div>
                        <strong>Clients Trained:</strong> {aggregation.clientsTrained}
                      </div>
                      <div>
                        <strong>Time Taken:</strong> {aggregation.timeTaken}s
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default RoundTracker;