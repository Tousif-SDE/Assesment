// client/src/pages/teacher/TeacherDashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetMyRoomsQuery, useDeleteRoomMutation } from '../../redux/api/roomApi';
import { 
  useGetSubmissionsByStudentQuery, 
  useGetRoomSubmissionsQuery,
  useGetTeacherDashboardQuery 
} from '../../redux/api/codeApi';
import { Spinner, Card, Badge, Table, Alert, Modal, Button } from 'react-bootstrap'; // Import components from react-bootstrap
import useSocket from '../../hooks/useSocket';
import { formatDistanceToNow } from 'date-fns';

const TeacherDashboard = () => {
  const { data: rooms, error, isLoading, refetch } = useGetMyRoomsQuery();
  const { data: submissions, error: submissionsError, isLoading: isLoadingSubmissions } = useGetSubmissionsByStudentQuery();
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [deleteRoom, { isLoading: isDeleting }] = useDeleteRoomMutation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);
  
  // Get submissions for selected room
  const { data: roomSubmissions, isLoading: isLoadingRoomSubmissions } = useGetRoomSubmissionsQuery(selectedRoomId, {
    skip: !selectedRoomId,
    pollingInterval: 5000, // Auto-refresh every 5 seconds
  });
  
  // Get teacher dashboard data
  const { data: dashboardData, isLoading: isLoadingDashboard, refetch: refetchDashboard } = useGetTeacherDashboardQuery();
  
  // State for real-time dashboard data
  const [realtimeDashboard, setRealtimeDashboard] = useState(null);
  
  // Socket connection for real-time updates
  const { socket, isConnected } = useSocket(selectedRoomId);

  useEffect(() => {
    // Refetch rooms when component mounts
    refetch();
    
    // Auto-select first room if available
    if (rooms && rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms]);
  
  // Listen for real-time dashboard updates
  useEffect(() => {
    if (socket && isConnected && selectedRoomId) {
      // Handle real-time dashboard updates
      const handleDashboardUpdate = (updatedData) => {
        console.log('Received dashboard update:', updatedData);
        setRealtimeDashboard(updatedData);
      };

      // Subscribe to teacherDashboardUpdate events
      socket.on('teacherDashboardUpdate', handleDashboardUpdate);

      // Cleanup on unmount
      return () => {
        socket.off('teacherDashboardUpdate');
      };
    }
  }, [socket, isConnected, selectedRoomId]);

  // Process room submissions data to get student statistics
  const getStudentStatistics = (roomSubs) => {
    if (!roomSubs || !Array.isArray(roomSubs)) {
      return {
        totalStudents: 0,
        totalSubmissions: 0,
        solvedSubmissions: 0,
        students: []
      };
    }

    // Group submissions by student
    const studentMap = {};
    
    roomSubs.forEach(submission => {
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
          testCases: new Set()
        };
      }
      
      studentMap[studentId].submissions.push(submission);
      studentMap[studentId].attempted++;
      studentMap[studentId].testCases.add(submission.testCaseId || 'unknown');
      
      if (submission.status === 'Solved') {
        studentMap[studentId].solved++;
      }
      
      // Track last activity
      const submissionTime = new Date(submission.createdAt || submission.submittedAt);
      if (!studentMap[studentId].lastActivity || submissionTime > studentMap[studentId].lastActivity) {
        studentMap[studentId].lastActivity = submissionTime;
      }
    });

    const students = Object.values(studentMap).map(student => ({
      ...student,
      testCases: student.testCases.size,
      successRate: student.attempted > 0 ? Math.round((student.solved / student.attempted) * 100) : 0
    }));

    return {
      totalStudents: students.length,
      totalSubmissions: roomSubs.length,
      solvedSubmissions: roomSubs.filter(s => s.status === 'Solved').length,
      students: students.sort((a, b) => b.solved - a.solved) // Sort by solved count
    };
  };

  const selectedRoom = rooms?.find(room => room.id === selectedRoomId);
  const studentStats = getStudentStatistics(roomSubmissions);

  // Format timestamp
  const formatTime = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (err) {
      return 'Unknown time';
    }
  };
  
  // Handle room deletion
  const handleDeleteClick = (room) => {
    setRoomToDelete(room);
    setShowDeleteConfirm(true);
  };
  
  const confirmDeleteRoom = async () => {
    try {
      await deleteRoom(roomToDelete.id);
      // If the deleted room was selected, clear the selection
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

  // Get the dashboard data (either real-time or from API)
  const displayDashboard = realtimeDashboard || dashboardData;

  return (
    <div className="container mx-auto px-4 py-4">
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
      {/* Real-time Dashboard Section */}
      {displayDashboard && (
        <div className="mb-6">
          <h4 className="text-gray-600 font-medium mb-4">Real-time Dashboard</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="shadow-sm border-0">
              <Card.Body className="text-center">
                <h3 className="text-primary">{displayDashboard.totalActive}</h3>
                <p className="text-muted mb-0">Active Students</p>
                <small className="text-muted">(Last {displayDashboard.activeTimeWindowMinutes || 30} min)</small>
              </Card.Body>
            </Card>
            
            <Card className="shadow-sm border-0">
              <Card.Body className="text-center">
                <h3 className="text-info">{displayDashboard.totalAttempted}</h3>
                <p className="text-muted mb-0">Test Cases Attempted</p>
              </Card.Body>
            </Card>
            
            <Card className="shadow-sm border-0">
              <Card.Body className="text-center">
                <h3 className="text-success">{displayDashboard.totalSolved}</h3>
                <p className="text-muted mb-0">Test Cases Solved</p>
              </Card.Body>
            </Card>
          </div>
          
          {/* Solved Test Cases */}
          <Card className="shadow-sm border-0 mb-4">
            <Card.Header className="bg-white">
              <h5 className="mb-0">Solved Test Cases</h5>
            </Card.Header>
            <Card.Body>
              {displayDashboard.solvedTestCases && displayDashboard.solvedTestCases.length > 0 ? (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Test Case</th>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Time Taken</th>
                      <th>Solved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayDashboard.solvedTestCases.map((testCase, index) => (
                      <tr key={`${testCase.testCaseId}-${testCase.studentId}-${index}`}>
                        <td>{testCase.testCaseId.substring(0, 8)}...</td>
                        <td>{testCase.studentName}</td>
                        <td>
                          <Badge bg="success">Solved</Badge>
                        </td>
                        <td>{testCase.timeTaken} seconds</td>
                        <td>{formatTime(testCase.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Alert variant="light">No solved test cases yet.</Alert>
              )}
            </Card.Body>
          </Card>
          
          {/* Recent Submissions */}
          <Card className="shadow-sm border-0 mb-4">
            <Card.Header className="bg-white">
              <h5 className="mb-0">Recent Submissions</h5>
            </Card.Header>
            <Card.Body>
              {displayDashboard.submissions && displayDashboard.submissions.length > 0 ? (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Test Case</th>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Time Taken</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayDashboard.submissions.slice(0, 10).map((submission) => (
                      <tr key={submission.id}>
                        <td>{submission.id.substring(0, 8)}...</td>
                        <td>{submission.testCaseTitle}</td>
                        <td>{submission.studentName}</td>
                        <td>
                          <Badge 
                            bg={submission.status === 'Solved' ? 'success' : 'danger'}
                          >
                            {submission.status}
                          </Badge>
                        </td>
                        <td>{submission.timeTaken} seconds</td>
                        <td>{formatTime(submission.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Alert variant="light">No submissions yet.</Alert>
              )}
            </Card.Body>
          </Card>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-gray-600 font-medium">Live Code Rooms</h4>
        </div>
        <div>
          <Link to="/teacher/create-room">
            <button className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-full">
              Create
            </button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="secondary" />
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error?.data?.message || 'Failed to load classrooms'}
        </div>
      ) : rooms?.length === 0 ? (
        <div className="bg-gray-50 text-center shadow-sm py-5 rounded">
          <div className="mb-2">You haven't created any classrooms yet.</div>
          <div>Click the "Create" button to get started.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {rooms?.map((room) => (
            <div key={room.id} className="mb-4">
              <div className={`h-full bg-white rounded-lg shadow-sm border ${
                selectedRoomId === room.id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-100'
              }`}>
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="font-medium">{room.college}</h5>
                    <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded border">{room.code}</span>
                  </div>
                  <div className="text-gray-600 text-sm">
                    <div className="grid grid-cols-2 mb-2">
                      <div>Tutor: {room.tutor || room.roomName}</div>
                      <div>Batch: {room.batchYear}</div>
                    </div>
                    <div className="grid grid-cols-2">
                      <div>Students: {room.totalStudents}</div>
                      <div>Duration: {room.totalDuration} min</div>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-3 text-right border-t flex gap-2 justify-end">
                  <button
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`text-sm font-medium py-1 px-3 rounded-full ${
                      selectedRoomId === room.id 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {selectedRoomId === room.id ? 'Selected' : 'View Stats'}
                  </button>
                  <Link to={`/teacher/room/${room.id}`}>
                    <button className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium py-1 px-3 rounded-full">
                      Join
                    </button>
                  </Link>
                  <button 
                    onClick={() => handleDeleteClick(room)}
                    className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-1 px-3 rounded-full"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student Statistics Section */}
      {selectedRoom && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-gray-600 font-medium">
              Student Activity - {selectedRoom.roomName || selectedRoom.college}
            </h4>
            {isLoadingRoomSubmissions && (
              <Spinner animation="border" size="sm" variant="secondary" />
            )}
          </div>

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{studentStats.totalStudents}</div>
              <div className="text-sm text-gray-600">Active Students</div>
              <div className="text-xs text-gray-500">(Last {roomSubmissions?.activeTimeWindowMinutes || 30} min)</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{studentStats.solvedSubmissions}</div>
              <div className="text-sm text-gray-600">Solved</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{studentStats.totalSubmissions}</div>
              <div className="text-sm text-gray-600">Total Submissions</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">
                {studentStats.totalSubmissions > 0 ? Math.round((studentStats.solvedSubmissions / studentStats.totalSubmissions) * 100) : 0}%
              </div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
          </div>

          {/* Detailed Student List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="bg-gray-50 px-6 py-4 border-b">
              <h5 className="font-medium text-gray-800">Student Performance Details</h5>
            </div>
            <div className="p-6">
              {studentStats.students.length > 0 ? (
                <div className="space-y-4">
                  {studentStats.students.map((student, index) => (
                    <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <h6 className="font-medium text-gray-800">{student.name}</h6>
                          <p className="text-sm text-gray-500">{student.email}</p>
                          <p className="text-xs text-gray-400">
                            Last active: {student.lastActivity ? student.lastActivity.toLocaleString() : 'Never'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{student.testCases}</div>
                          <div className="text-xs text-gray-500">Test Cases</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-yellow-600">{student.attempted}</div>
                          <div className="text-xs text-gray-500">Attempted</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{student.solved}</div>
                          <div className="text-xs text-gray-500">Solved</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-lg font-bold ${
                            student.successRate >= 80 ? 'text-green-600' : 
                            student.successRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {student.successRate}%
                          </div>
                          <div className="text-xs text-gray-500">Success</div>
                        </div>
                      </div>
                      
                      <div className="w-24">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${student.successRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No student activity yet in this room.</p>
                  <p className="text-sm">Students will appear here once they start submitting solutions.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Original Submissions Section (Legacy) */}
      <h4 className="text-gray-600 font-medium">All Submissions Overview</h4>
      {isLoadingSubmissions ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="secondary" />
        </div>
      ) : submissionsError ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {submissionsError?.data?.message || 'Failed to load submissions'}
        </div>
      ) : (
        <div className="bg-gray-50 rounded shadow-sm p-4 mb-4">
          {/* Summary Section */}
          <div className="mb-3">
            <div className="font-medium">Test Case Published: Waiting for Students to solve</div>
            <div className="text-sm text-gray-700">
              Total Active: {Array.isArray(submissions) ? submissions.length : 0} &nbsp;
              Total Solved: {Array.isArray(submissions) ? submissions.filter(s => s.status === 'Solved').length : 0} &nbsp;
              Total Attempted: {Array.isArray(submissions) ? submissions.length : 0}
            </div>
          </div>
          {/* Student List */}
          <ol className="list-decimal pl-5">
            {Array.isArray(submissions) && submissions.length > 0 ? (
              submissions.map((submission, idx) => (
                <li key={submission.id} className="mb-1">
                  {submission.studentName || `Student ${idx + 1}`} {submission.status === 'Solved' ? 'Solved' : 'Not Solved'}
                </li>
              ))
            ) : (
              <li>No submissions yet.</li>
            )}
          </ol>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;