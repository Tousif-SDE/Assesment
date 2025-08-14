// client/src/pages/student/JoinRoom.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useJoinRoomMutation } from '../../redux/api/roomApi';

const JoinRoom = () => {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();
  const [joinRoom, { isLoading }] = useJoinRoomMutation();

  const submitHandler = async (e) => {
    e.preventDefault();
    setError(null);

    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    try {
      const result = await joinRoom({ code: roomCode }).unwrap();
      if (result.message === 'Already joined this room' && result.room) {
        setError('You have already joined this room. Redirecting...');
        setTimeout(() => {
          navigate(`/student/room/${result.room.id}`);
        }, 1200);
      } else {
        navigate(`/student/room/${result.room.id}`);
      }
    } catch (err) {
      console.error('Error joining room:', err);
      let errorMsg = 'Failed to join room';
      if (err?.data?.message) {
        errorMsg = err.data.message;
      } else if (err?.message) {
        errorMsg = err.message;
      } else if (typeof err === 'string') {
        errorMsg = err;
      } else if (err?.status === 500 && err?.data?.error) {
        errorMsg = err.data.error;
      }
      setError(errorMsg);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 25%, #C084FC 75%, #DDD6FE 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      margin: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'auto',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      <Container>
        <Row className="justify-content-center">
          <Col xs={12} sm={10} md={8} lg={6} xl={5}>
            <Card 
              className="border-0 shadow-lg"
              style={{
                borderRadius: '32px',
                background: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 32px 64px rgba(139, 92, 246, 0.15)'
              }}
            >
              <Card.Body className="p-5">
                <div className="text-center mb-5">
                  <div className="mb-4">
                    <div 
                      className="d-inline-block px-4 py-2 rounded-pill text-white fw-bold"
                      style={{
                        background: 'linear-gradient(45deg, #8B5CF6, #A855F7)',
                        fontSize: '1.1rem',
                        letterSpacing: '0.5px',
                        boxShadow: '0 8px 16px rgba(139, 92, 246, 0.3)'
                      }}
                    >
                      skelo
                    </div>
                  </div>
                  
                  <h1 
                    className="fw-bold mb-3"
                    style={{
                      color: '#1E293B',
                      fontSize: '2.5rem',
                      letterSpacing: '-0.025em',
                      lineHeight: '1.2'
                    }}
                  >
                    Student Access
                  </h1>
                  
                  <p 
                    className="mb-0"
                    style={{
                      color: '#64748B',
                      fontSize: '1.2rem',
                      fontWeight: '400'
                    }}
                  >
                    Join Live Room
                  </p>
                </div>

                {error && (
                  <Alert 
                    variant="danger" 
                    className="border-0 mb-4 d-flex align-items-center"
                    style={{
                      borderRadius: '20px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#DC2626',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      padding: '16px 20px'
                    }}
                  >
                    <i className="bi bi-exclamation-triangle-fill me-3" style={{ fontSize: '1.2rem' }}></i>
                    <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{error}</span>
                  </Alert>
                )}

                <Form onSubmit={submitHandler}>
                  <div className="mb-5">
                    <Form.Group>
                      <Form.Control
                        type="text"
                        id="roomCode"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value)}
                        placeholder="Enter Code"
                        className="text-center border-0 py-4 px-4"
                        style={{
                          borderRadius: '24px',
                          background: '#F8FAFC',
                          fontSize: '1.5rem',
                          fontWeight: '600',
                          letterSpacing: '3px',
                          textTransform: 'uppercase',
                          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.06)',
                          border: '2px solid transparent',
                          transition: 'all 0.3s ease',
                          height: '70px'
                        }}
                        onFocus={(e) => {
                          e.target.style.background = '#FFFFFF';
                          e.target.style.borderColor = '#8B5CF6';
                          e.target.style.boxShadow = '0 0 0 4px rgba(139, 92, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.background = '#F8FAFC';
                          e.target.style.borderColor = 'transparent';
                          e.target.style.boxShadow = 'inset 0 2px 8px rgba(0, 0, 0, 0.06)';
                        }}
                        required
                      />
                    </Form.Group>
                  </div>

                  <div className="d-grid mb-4">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="border-0 py-4 fw-bold"
                      style={{
                        borderRadius: '24px',
                        background: 'linear-gradient(45deg, #FBBF24, #F59E0B)',
                        fontSize: '1.3rem',
                        letterSpacing: '0.5px',
                        boxShadow: '0 8px 32px rgba(251, 191, 36, 0.4)',
                        transition: 'all 0.3s ease',
                        height: '70px'
                      }}
                      onMouseEnter={(e) => {
                        if (!isLoading) {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 16px 48px rgba(251, 191, 36, 0.5)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 8px 32px rgba(251, 191, 36, 0.4)';
                      }}
                    >
                      {isLoading ? (
                        <>
                          <Spinner 
                            animation="border" 
                            size="sm" 
                            className="me-3"
                            style={{ width: '1.2rem', height: '1.2rem' }}
                          />
                          Joining...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-box-arrow-in-right me-3" style={{ fontSize: '1.2rem' }}></i>
                          Join
                        </>
                      )}
                    </Button>
                  </div>
                </Form>

                <div className="text-center">
                  <small 
                    style={{
                      color: '#94A3B8',
                      fontSize: '0.95rem',
                      fontWeight: '500'
                    }}
                  >
                    Enter the room code provided by your instructor
                  </small>
                </div>
              </Card.Body>
            </Card>

            <div className="text-center mt-4">
              <small 
                className="text-white"
                style={{
                  fontSize: '1rem',
                  opacity: 0.9,
                  fontWeight: '500'
                }}
              >
                Powered by{' '}
                <span className="fw-bold">Skelo</span>
              </small>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default JoinRoom;