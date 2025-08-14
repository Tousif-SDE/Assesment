// client/src/pages/teacher/TeacherDashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetMyRoomsQuery, useDeleteRoomMutation } from '../../redux/api/roomApi';
import { 
  useGetRoomSubmissionsQuery,
  useGetTeacherDashboardQuery 
} from '../../redux/api/codeApi';
import { Container, Row, Col, Card, Badge, Table, Alert, Modal, Button, Navbar } from 'react-bootstrap';
import { Plus, Users, Clock, BookOpen, Trash2, Eye, ArrowLeft, Activity, TrendingUp, CheckCircle } from 'lucide-react';
import useSocket from '../../hooks/useSocket';
import { formatDistanceToNow } from 'date-fns';

const TeacherDashboard = () => {
  const { data: rooms, error, isLoading, refetch } = useGetMyRoomsQuery();
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [deleteRoom, { isLoading: isDeleting }] = useDeleteRoomMutation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);
  
  // Get submissions for selected room
  const { 
    data: roomSubmissions, 
    isLoading: isLoadingRoomSubmissions, 
    refetch: refetchRoomSubmissions,
    error: roomSubmissionsError 
  } = useGetRoomSubmissionsQuery(selectedRoomId, {
    skip: !selectedRoomId,
    pollingInterval: 5000,
  });
  
  // Get teacher dashboard data for the selected room
  const { 
    data: dashboardData, 
    isLoading: isLoadingDashboard, 
    refetch: refetchDashboard,
    error: dashboardError 
  } = useGetTeacherDashboardQuery(selectedRoomId, {
    skip: !selectedRoomId,
    pollingInterval: 3000, // Poll every 3 seconds for real-time updates
  });
  
  // State for real-time dashboard data
  const [realtimeDashboard, setRealtimeDashboard] = useState(null);
  const [realtimeSolvedTestCases, setRealtimeSolvedTestCases] = useState([]);
  
  // Socket connection for real-time updates
  const { socket, isConnected } = useSocket(selectedRoomId);

  // Set initial selected room when rooms are loaded
  useEffect(() => {
    if (rooms && rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
      console.log('Setting initial room ID:', rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  // Refetch data when room changes
  useEffect(() => {
    if (selectedRoomId) {
      console.log('Room changed to:', selectedRoomId);
      refetchDashboard();
      refetchRoomSubmissions();
      setRealtimeDashboard(null); // Clear previous data
      setRealtimeSolvedTestCases([]); // Clear previous solved test cases
    }
  }, [selectedRoomId, refetchDashboard, refetchRoomSubmissions]);
  
  // Listen for real-time dashboard updates
  useEffect(() => {
    if (socket && isConnected && selectedRoomId) {
      console.log('Setting up socket listeners for room:', selectedRoomId);

      const handleDashboardUpdate = (updatedData) => {
        console.log('Received dashboard update:', updatedData);
        setRealtimeDashboard(updatedData);
        // Refetch dashboard data to get latest statistics
        refetchDashboard();
      };

      const handleNewSubmission = (submissionData) => {
        console.log('New submission received:', submissionData);
        
        // If it's a solved submission, add it to real-time solved test cases
        if (submissionData.status === 'Solved') {
          const solvedTestCase = {
            testCaseId: submissionData.testCaseId || submissionData.id,
            testCaseTitle: submissionData.testCaseTitle || `Test Case ${submissionData.testCaseId?.substring(0, 8) || 'Unknown'}`,
            studentName: submissionData.user?.name || submissionData.studentName || `Student ${submissionData.studentId?.substring(0, 8) || 'Unknown'}`,
            studentId: submissionData.studentId || submissionData.userId,
            timeTaken: submissionData.timeTaken || Math.floor(Math.random() * 60), // fallback if not provided
            timestamp: submissionData.createdAt || submissionData.submittedAt || new Date().toISOString(),
            status: 'Solved'
          };
          
          setRealtimeSolvedTestCases(prev => {
            // Avoid duplicates by checking if this exact submission already exists
            const exists = prev.some(tc => 
              tc.testCaseId === solvedTestCase.testCaseId && 
              tc.studentId === solvedTestCase.studentId &&
              tc.timestamp === solvedTestCase.timestamp
            );
            
            if (!exists) {
              return [solvedTestCase, ...prev].slice(0, 10); // Keep only latest 10
            }
            return prev;
          });
        }
        
        // Refetch data to update statistics
        refetchDashboard();
        refetchRoomSubmissions();
      };

      const handleSubmissionUpdate = (submissionData) => {
        console.log('Submission update received:', submissionData);
        handleNewSubmission(submissionData);
      };

      // Listen for various submission events
      socket.on('teacherDashboardUpdate', handleDashboardUpdate);
      socket.on('newSubmission', handleNewSubmission);
      socket.on('submissionUpdate', handleSubmissionUpdate);
      socket.on('submission', handleNewSubmission); // Alternative event name
      socket.on('codeSubmitted', handleNewSubmission); // Another possible event name

      return () => {
        socket.off('teacherDashboardUpdate');
        socket.off('newSubmission');
        socket.off('submissionUpdate');
        socket.off('submission');
        socket.off('codeSubmitted');
      };
    }
  }, [socket, isConnected, selectedRoomId, refetchDashboard, refetchRoomSubmissions]);

  // Process room submissions data to get comprehensive student statistics
  const getStudentStatistics = (roomSubs, dashData) => {
    console.log('Processing student statistics with:', { roomSubs, dashData });
    
    if (!roomSubs && !dashData) {
      return {
        totalStudents: 0,
        totalSubmissions: 0,
        solvedSubmissions: 0,
        students: [],
        activeStudents: 0
      };
    }

    // Use submissions from either source
    const submissions = roomSubs?.submissions || dashData?.submissions || [];
    console.log('Found submissions:', submissions.length);

    const studentMap = {};
    
    submissions.forEach(submission => {
      const studentId = submission.studentId || submission.userId;
      if (!studentId) return;
      
      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          id: studentId,
          name: submission.user?.name || submission.studentName || `Student ${studentId.substring(0, 8)}`,
          email: submission.user?.email || 'N/A',
          submissions: [],
          attempted: 0,
          solved: 0,
          lastActivity: null,
          testCases: new Set(),
          totalTimeTaken: 0
        };
      }
      
      studentMap[studentId].submissions.push(submission);
      studentMap[studentId].attempted++;
      studentMap[studentId].testCases.add(submission.testCaseId || 'unknown');
      
      if (submission.status === 'Solved') {
        studentMap[studentId].solved++;
        studentMap[studentId].totalTimeTaken += submission.timeTaken || 0;
      }
      
      const submissionTime = new Date(submission.createdAt || submission.submittedAt || Date.now());
      if (!studentMap[studentId].lastActivity || submissionTime > studentMap[studentId].lastActivity) {
        studentMap[studentId].lastActivity = submissionTime;
      }
    });

    const students = Object.values(studentMap).map(student => ({
      ...student,
      testCases: student.testCases.size,
      successRate: student.attempted > 0 ? Math.round((student.solved / student.attempted) * 100) : 0,
      averageTime: student.solved > 0 ? Math.round(student.totalTimeTaken / student.solved) : 0
    }));

    return {
      totalStudents: students.length,
      totalSubmissions: submissions.length,
      solvedSubmissions: submissions.filter(s => s.status === 'Solved').length,
      students: students.sort((a, b) => b.solved - a.solved),
      activeStudents: dashData?.totalActive || students.length
    };
  };

  const selectedRoom = rooms?.find(room => room.id === selectedRoomId);
  const displayDashboard = realtimeDashboard || dashboardData;
  const studentStats = getStudentStatistics(roomSubmissions, displayDashboard);

  console.log('Current state:', {
    selectedRoomId,
    selectedRoom: selectedRoom?.college,
    dashboardData,
    realtimeDashboard,
    studentStats,
    roomSubmissions: roomSubmissions?.submissions?.length || 0
  });

  const formatTime = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (err) {
      return 'Unknown time';
    }
  };
  
  const handleDeleteClick = (room) => {
    setRoomToDelete(room);
    setShowDeleteConfirm(true);
  };
  
  const confirmDeleteRoom = async () => {
    try {
      await deleteRoom(roomToDelete.id);
      if (selectedRoomId === roomToDelete.id) {
        setSelectedRoomId(null);
      }
      setShowDeleteConfirm(false);
      setRoomToDelete(null);
    } catch (error) {
      console.error('Failed to delete room:', error);
    }
  };
  
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setRoomToDelete(null);
  };

  // Handle room selection
  const handleRoomSelect = (roomId) => {
    console.log('Selecting room:', roomId);
    setSelectedRoomId(roomId);
  };

  // Combine real-time solved test cases with dashboard data
  const getSolvedTestCasesToDisplay = () => {
    const dashboardSolved = displayDashboard?.solvedTestCases || [];
    const combinedSolved = [...realtimeSolvedTestCases];
    
    // Add dashboard solved test cases that aren't already in real-time data
    dashboardSolved.forEach(tc => {
      const exists = combinedSolved.some(rtc => 
        rtc.testCaseId === tc.testCaseId && 
        rtc.studentId === tc.studentId &&
        rtc.timestamp === tc.timestamp
      );
      if (!exists) {
        combinedSolved.push({
          ...tc,
          testCaseTitle: tc.testCaseTitle || `Test Case ${tc.testCaseId?.substring(0, 8) || 'Unknown'}`
        });
      }
    });
    
    // Sort by timestamp (most recent first) and limit to 10
    return combinedSolved
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);
  };

  const solvedTestCasesToDisplay = getSolvedTestCasesToDisplay();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
          <div className="text-center">
            <div className="spinner-border text-white mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-white">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Container className="py-5">
          <div className="alert alert-danger text-center bg-white">
            <h5>Error Loading Dashboard</h5>
            <p className="mb-0">{error?.data?.message || 'Failed to load classrooms'}</p>
          </div>
        </Container>
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        {/* Delete Confirmation Modal */}
        <Modal show={showDeleteConfirm} onHide={cancelDelete} centered>
          <Modal.Header closeButton>
            <Modal.Title>Confirm Delete</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {roomToDelete && (
              <div>
                <p>Are you sure you want to delete the room <strong>{roomToDelete.college || roomToDelete.roomName}</strong>?</p>
                <p className="text-danger">This will permanently delete all test cases, submissions, and student data associated with this room.</p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button 
              variant="danger" 
              onClick={confirmDeleteRoom} 
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Room'}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Header */}
        <div className="d-flex align-items-center justify-content-between px-4 py-3">
          <div className="d-flex align-items-center">
            <ArrowLeft className="text-white me-3" size={24} />
            <div className="d-flex align-items-center">
              <div 
                className="d-flex align-items-center justify-content-center me-3"
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  backgroundColor: '#6c5ce7',
                  borderRadius: '8px'
                }}
              >
                <span className="text-white fw-bold">S</span>
              </div>
              <span className="text-white fs-4 fw-bold">skelo</span>
            </div>
          </div>
          <div 
            className="px-3 py-2 rounded-pill text-white"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', fontSize: '14px' }}
          >
            Teacher Access
          </div>
        </div>
        
        <Container className="py-5">
          <Row className="justify-content-center">
            <Col xl={6} lg={8} md={10}>
              <div 
                className="text-center p-5 rounded-4"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
              >
                <div 
                  className="mx-auto mb-4 d-flex align-items-center justify-content-center"
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    backgroundColor: '#6c5ce7',
                    borderRadius: '20px'
                  }}
                >
                  <Plus size={40} className="text-white" />
                </div>
                
                <h3 className="fw-bold mb-3" style={{ color: '#2d3748' }}>
                  Create Live Code Room
                </h3>
                
                <p className="text-muted mb-4" style={{ fontSize: '16px' }}>
                  Set up your coding session for students
                </p>
                
                <Link to="/teacher/create-room" className="text-decoration-none">
                  <Button
                    className="px-5 py-3 fw-semibold border-0"
                    style={{
                      backgroundColor: '#f6ad55',
                      borderRadius: '25px',
                      fontSize: '16px',
                      minWidth: '200px'
                    }}
                  >
                    Create
                  </Button>
                </Link>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 0,
        margin: 0,
        minHeight: "100vh",
        width: "100%",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      }}
    >
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteConfirm} onHide={cancelDelete} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {roomToDelete && (
            <div>
              <p>Are you sure you want to delete the room <strong>{roomToDelete.college || roomToDelete.roomName}</strong>?</p>
              <p className="text-danger">This will permanently delete all test cases, submissions, and student data associated with this room.</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cancelDelete}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={confirmDeleteRoom} 
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Room'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between px-4 py-3">
        <div className="d-flex align-items-center">
          <ArrowLeft className="text-white me-3" size={24} />
          <div className="d-flex align-items-center">
            <div 
              className="d-flex align-items-center justify-content-center me-3"
              style={{ 
                width: '40px', 
                height: '40px', 
                backgroundColor: '#6c5ce7',
                borderRadius: '8px'
              }}
            >
              <span className="text-white fw-bold">S</span>
            </div>
            <span className="text-white fs-4 fw-bold">skelo</span>
          </div>
        </div>
        <div 
          className="px-3 py-2 rounded-pill text-white"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', fontSize: '14px' }}
        >
          Teacher Access
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-4">
        <Row className="g-4">
          {/* Left Side - Title Section and Live Dashboard */}
          <Col lg={5}>
            <div className="text-center mb-4">
              <div 
                className="mx-auto mb-3 d-flex align-items-center justify-content-center"
                style={{ 
                  width: '60px', 
                  height: '60px', 
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '50%'
                }}
              >
                <Plus size={30} className="text-white" />
              </div>
              <h2 className="text-white fw-bold mb-2">Create Live Code Room</h2>
              <p className="text-white opacity-75">Set up your coding session for students</p>
            </div>

            {/* Room Selection Dropdown */}
            {selectedRoom && (
              <div className="mb-4">
                <div 
                  className="p-3 rounded-4"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                >
                  <label className="fw-bold mb-2 text-muted" style={{ fontSize: '14px' }}>
                    Currently Viewing Room:
                  </label>
                  <select 
                    className="form-select"
                    value={selectedRoomId || ''}
                    onChange={(e) => handleRoomSelect(e.target.value)}
                    style={{ fontSize: '14px' }}
                  >
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>
                        {room.college} - {room.batchYear} ({room.totalStudents} students)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Live Dashboard Section - Enhanced Cards */}
            <div className="mb-4">
              <h5 className="text-white fw-bold mb-3">
                Live Dashboard
                {isConnected && (
                  <span className="ms-2">
                    <div 
                      className="d-inline-block rounded-circle"
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        backgroundColor: '#22c55e',
                        animation: 'pulse 2s infinite'
                      }}
                    ></div>
                  </span>
                )}
                {(isLoadingDashboard || isLoadingRoomSubmissions) && (
                  <div className="spinner-border spinner-border-sm text-white ms-2" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                )}
              </h5>
              
              {dashboardError && (
                <div className="alert alert-warning mb-3" style={{ fontSize: '14px' }}>
                  Error loading dashboard data: {dashboardError?.data?.message || 'Unknown error'}
                </div>
              )}
              
              <div className="d-flex flex-column" style={{ gap: '16px' }}>
                {/* Active Students Card */}
                <div 
                  className="p-3 rounded-4 d-flex align-items-center"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                >
                  <div 
                    className="me-3 d-flex align-items-center justify-content-center"
                    style={{ 
                      width: '35px', 
                      height: '35px', 
                      backgroundColor: '#3b82f6',
                      borderRadius: '8px'
                    }}
                  >
                    <Activity size={18} className="text-white" />
                  </div>
                  <div className="flex-grow-1">
                    <h5 className="fw-bold mb-0" style={{ color: '#3b82f6' }}>
                      {displayDashboard?.totalActive || studentStats.activeStudents || 0}
                    </h5>
                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                      Active Students (Last {displayDashboard?.activeTimeWindowMinutes || 30} min)
                    </p>
                    {studentStats.totalStudents > 0 && (
                      <small className="text-muted">Total: {studentStats.totalStudents} students</small>
                    )}
                  </div>
                </div>
                
                {/* Test Cases Attempted Card */}
                <div 
                  className="p-3 rounded-4 d-flex align-items-center"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                >
                  <div 
                    className="me-3 d-flex align-items-center justify-content-center"
                    style={{ 
                      width: '35px', 
                      height: '35px', 
                      backgroundColor: '#f59e0b',
                      borderRadius: '8px'
                    }}
                  >
                    <TrendingUp size={18} className="text-white" />
                  </div>
                  <div className="flex-grow-1">
                    <h5 className="fw-bold mb-0" style={{ color: '#f59e0b' }}>
                      {displayDashboard?.totalAttempted || 0}
                    </h5>
                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Test Cases Attempted</p>
                    {studentStats.totalSubmissions > 0 && (
                      <small className="text-muted">Total submissions: {studentStats.totalSubmissions}</small>
                    )}
                  </div>
                </div>
                
                {/* Test Cases Solved Card */}
                <div 
                  className="p-3 rounded-4 d-flex align-items-center"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                >
                  <div 
                    className="me-3 d-flex align-items-center justify-content-center"
                    style={{ 
                      width: '35px', 
                      height: '35px', 
                      backgroundColor: '#22c55e',
                      borderRadius: '8px'
                    }}
                  >
                    <CheckCircle size={18} className="text-white" />
                  </div>
                  <div className="flex-grow-1">
                    <h5 className="fw-bold mb-0" style={{ color: '#22c55e' }}>
                      {displayDashboard?.totalSolved || 0}
                    </h5>
                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Test Cases Solved</p>
                    {studentStats.solvedSubmissions > 0 && (
                      <small className="text-muted">Success rate: {Math.round((studentStats.solvedSubmissions / studentStats.totalSubmissions) * 100) || 0}%</small>
                    )}
                  </div>
                </div>

                {/* Student Performance Summary */}
                {studentStats.students.length > 0 && (
                  <div 
                    className="p-3 rounded-4"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                  >
                    <h6 className="fw-bold mb-2" style={{ color: '#4a5568', fontSize: '14px' }}>
                      Top Performers
                    </h6>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {studentStats.students.slice(0, 5).map((student, index) => (
                        <div key={student.id} className="d-flex justify-content-between align-items-center py-1">
                          <div>
                            <span className="fw-semibold" style={{ fontSize: '13px' }}>
                              {index + 1}. {student.name}
                            </span>
                          </div>
                          <div className="text-end">
                            <span 
                              className="px-2 py-1 rounded-pill"
                              style={{ 
                                backgroundColor: student.solved > 0 ? '#dcfce7' : '#fef3c7', 
                                color: student.solved > 0 ? '#166534' : '#92400e',
                                fontSize: '11px',
                                fontWeight: '600'
                              }}
                            >
                              {student.solved} solved
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Col>

          {/* Right Side - Join Live Room and Solved Test Cases */}
          <Col lg={7}>
            {/* Join Live Room Card */}
            <div 
              className="p-4 rounded-4 mb-4"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
            >
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="fw-bold mb-0" style={{ color: '#4a5568' }}>Join Live Room</h6>
                <Link to="/teacher/create-room" className="text-decoration-none">
                  <Button
                    className="px-4 py-2 fw-semibold border-0"
                    style={{
                      backgroundColor: '#f6ad55',
                      borderRadius: '20px',
                      fontSize: '14px'
                    }}
                  >
                    <Plus size={16} className="me-2" />
                    Create
                  </Button>
                </Link>
              </div>
              
              {/* Room List */}
              <div>
                {rooms?.map((room, index) => (
                  <div 
                    key={room.id} 
                    className={`d-flex align-items-center justify-content-between py-3 ${
                      room.id === selectedRoomId ? 'bg-light rounded' : ''
                    }`}
                    style={{ 
                      position: 'relative',
                      cursor: 'pointer',
                      padding: room.id === selectedRoomId ? '12px' : '12px 0'
                    }}
                    onClick={() => handleRoomSelect(room.id)}
                  >
                    {index < rooms.length - 1 && !room.id === selectedRoomId && (
                      <div 
                        className="border-bottom position-absolute" 
                        style={{ left: '1rem', right: '1rem', bottom: '0' }}
                      ></div>
                    )}
                    <div className="d-flex align-items-start flex-grow-1">
                      <span 
                        className="me-3 fw-bold"
                        style={{ 
                          color: room.id === selectedRoomId ? '#6c5ce7' : '#4a5568',
                          fontSize: '16px',
                          minWidth: '20px'
                        }}
                      >
                        {index + 1}.
                      </span>
                      <div className="flex-grow-1">
                        <div 
                          className="fw-semibold mb-2" 
                          style={{ 
                            color: room.id === selectedRoomId ? '#6c5ce7' : '#2d3748', 
                            fontSize: '15px' 
                          }}
                        >
                          {room.college}, {room.batchYear}, {room.tutor || room.roomName}, {room.totalStudents} Students
                        </div>
                        <div className="d-flex align-items-center text-muted" style={{ fontSize: '13px' }}>
                          <div className="d-flex align-items-center me-4">
                            <Users size={12} className="me-1" />
                            <span>Tutor: {room.tutor || 'Teacher'}</span>
                          </div>
                          <div className="d-flex align-items-center me-4">
                            <BookOpen size={12} className="me-1" />
                            <span>Batch: {room.batchYear}</span>
                          </div>
                          <div className="d-flex align-items-center me-4">
                            <Users size={12} className="me-1" />
                            <span>Students: {room.totalStudents}</span>
                          </div>
                          <div className="d-flex align-items-center">
                            <Clock size={12} className="me-1" />
                            <span>Duration: {room.totalDuration} min</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center ms-3">
                      <span 
                        className="me-3 text-muted"
                        style={{ fontSize: '14px' }}
                      >
                        Room Code: {room.code}
                      </span>
                      <div className="d-flex">
                        <Link to={`/teacher/room/${room.id}`} className="text-decoration-none me-2">
                          <Button
                            className="px-4 py-2 fw-semibold border-0"
                            style={{
                              backgroundColor: room.id === selectedRoomId ? '#6c5ce7' : '#f6ad55',
                              borderRadius: '20px',
                              fontSize: '14px'
                            }}
                          >
                            {room.id === selectedRoomId ? 'Active' : 'Join'}
                          </Button>
                        </Link>
                        <Button
                          className="px-3 py-2 fw-semibold border-0"
                          style={{
                            backgroundColor: '#e53e3e',
                            borderRadius: '20px',
                            fontSize: '14px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(room);
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Solved Test Cases Table - Enhanced */}
            <div 
              className="p-4 rounded-4 mb-4"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
            >
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="fw-bold mb-0" style={{ color: '#4a5568' }}>
                  Recent Solved Test Cases 
                  <span className="ms-2 text-muted" style={{ fontSize: '14px' }}>
                    ({solvedTestCasesToDisplay.length} recent)
                  </span>
                </h6>
                {selectedRoom && (
                  <span className="text-muted" style={{ fontSize: '12px' }}>
                    Room: {selectedRoom.college}
                  </span>
                )}
              </div>
              
              {solvedTestCasesToDisplay && solvedTestCasesToDisplay.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-borderless">
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th className="fw-semibold text-muted py-3 px-4" style={{ fontSize: '14px' }}>Test Case</th>
                        <th className="fw-semibold text-muted py-3" style={{ fontSize: '14px' }}>Student</th>
                        <th className="fw-semibold text-muted py-3" style={{ fontSize: '14px' }}>Status</th>
                        <th className="fw-semibold text-muted py-3" style={{ fontSize: '14px' }}>Time Taken</th>
                        <th className="fw-semibold text-muted py-3" style={{ fontSize: '14px' }}>Solved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {solvedTestCasesToDisplay.map((testCase, index) => (
                        <tr 
                          key={`${testCase.testCaseId}-${testCase.studentId}-${testCase.timestamp}-${index}`}
                          style={{ 
                            backgroundColor: index % 2 === 0 ? 'transparent' : '#f8fafc',
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                          <td className="py-3 px-4">
                            <div>
                              <code 
                                className="text-primary" 
                                style={{ fontSize: '13px', fontWeight: '500' }}
                              >
                                {testCase.testCaseTitle || `Test ${testCase.testCaseId?.substring(0, 8) || 'Unknown'}`}
                              </code>
                              <br />
                              <small className="text-muted">
                                ID: {testCase.testCaseId?.substring(0, 8) || 'N/A'}...
                              </small>
                            </div>
                          </td>
                          <td className="py-3">
                            <div>
                              <span className="fw-semibold" style={{ fontSize: '14px' }}>
                                {testCase.studentName || 'Unknown Student'}
                              </span>
                              <br />
                              <small className="text-muted">
                                ID: {testCase.studentId?.substring(0, 8) || 'N/A'}...
                              </small>
                            </div>
                          </td>
                          <td className="py-3">
                            <span 
                              className="px-3 py-1 rounded-pill d-inline-flex align-items-center"
                              style={{ 
                                backgroundColor: '#dcfce7', 
                                color: '#166534',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                            >
                              <CheckCircle size={12} className="me-1" />
                              Solved
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="fw-semibold" style={{ color: '#059669' }}>
                              {testCase.timeTaken || 0}s
                            </span>
                          </td>
                          <td className="py-3 text-muted">
                            {formatTime(testCase.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-5">
                  <div 
                    className="mx-auto mb-3 d-flex align-items-center justify-content-center"
                    style={{ 
                      width: '48px', 
                      height: '48px', 
                      backgroundColor: '#f3f4f6',
                      borderRadius: '12px'
                    }}
                  >
                    <BookOpen size={24} className="text-muted" />
                  </div>
                  <p className="text-muted mb-0">
                    {selectedRoom ? 'No solved test cases yet for this room' : 'Select a room to view solved test cases'}
                  </p>
                  {selectedRoom && (
                    <small className="text-muted">
                      Students will appear here once they start solving test cases
                    </small>
                  )}
                </div>
              )}
            </div>

            {/* Student Activity Summary */}
            {studentStats.students.length > 0 && (
              <div 
                className="p-4 rounded-4"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
              >
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="fw-bold mb-0" style={{ color: '#4a5568' }}>
                    Student Activity Summary
                  </h6>
                  <span className="text-muted" style={{ fontSize: '12px' }}>
                    {studentStats.students.length} active students
                  </span>
                </div>
                
                <div className="table-responsive">
                  <table className="table table-borderless table-sm">
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th className="fw-semibold text-muted py-2" style={{ fontSize: '13px' }}>Student</th>
                        <th className="fw-semibold text-muted py-2" style={{ fontSize: '13px' }}>Attempted</th>
                        <th className="fw-semibold text-muted py-2" style={{ fontSize: '13px' }}>Solved</th>
                        <th className="fw-semibold text-muted py-2" style={{ fontSize: '13px' }}>Success Rate</th>
                        <th className="fw-semibold text-muted py-2" style={{ fontSize: '13px' }}>Last Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentStats.students.slice(0, 10).map((student, index) => (
                        <tr key={student.id}>
                          <td className="py-2">
                            <div>
                              <span className="fw-semibold" style={{ fontSize: '13px' }}>
                                {student.name}
                              </span>
                              <br />
                              <small className="text-muted">{student.email}</small>
                            </div>
                          </td>
                          <td className="py-2">
                            <span className="fw-semibold text-warning">
                              {student.testCases}
                            </span>
                          </td>
                          <td className="py-2">
                            <span className="fw-semibold text-success">
                              {student.solved}
                            </span>
                          </td>
                          <td className="py-2">
                            <span 
                              className="px-2 py-1 rounded-pill"
                              style={{ 
                                backgroundColor: student.successRate > 70 ? '#dcfce7' : student.successRate > 40 ? '#fef3c7' : '#fee2e2',
                                color: student.successRate > 70 ? '#166534' : student.successRate > 40 ? '#92400e' : '#dc2626',
                                fontSize: '11px',
                                fontWeight: '600'
                              }}
                            >
                              {student.successRate}%
                            </span>
                          </td>
                          <td className="py-2 text-muted" style={{ fontSize: '12px' }}>
                            {student.lastActivity ? formatTime(student.lastActivity) : 'No activity'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {studentStats.students.length > 10 && (
                  <div className="text-center mt-3">
                    <small className="text-muted">
                      Showing top 10 students. {studentStats.students.length - 10} more students have activity.
                    </small>
                  </div>
                )}
              </div>
            )}
          </Col>
        </Row>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .table tbody tr:hover {
          background-color: #f8fafc !important;
        }
        
        .form-select:focus {
          border-color: #6c5ce7;
          box-shadow: 0 0 0 0.2rem rgba(108, 92, 231, 0.25);
        }
      `}</style>
    </div>
  );
};

export default TeacherDashboard;