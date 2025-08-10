// client/src/pages/teacher/TeacherDashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetMyRoomsQuery } from '../../redux/api/roomApi';
import { useGetSubmissionsByStudentQuery, useGetRoomSubmissionsQuery } from '../../redux/api/codeApi';
import { Spinner } from 'react-bootstrap'; // Import Spinner from react-bootstrap

const TeacherDashboard = () => {
  const { data: rooms, error, isLoading, refetch } = useGetMyRoomsQuery();
  const { data: submissions, error: submissionsError, isLoading: isLoadingSubmissions } = useGetSubmissionsByStudentQuery();
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  
  // Get submissions for selected room
  const { data: roomSubmissions, isLoading: isLoadingRoomSubmissions } = useGetRoomSubmissionsQuery(selectedRoomId, {
    skip: !selectedRoomId,
    pollingInterval: 5000, // Auto-refresh every 5 seconds
  });

  useEffect(() => {
    // Refetch rooms when component mounts
    refetch();
    
    // Auto-select first room if available
    if (rooms && rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms]);

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

  return (
    <div className="container mx-auto px-4 py-4">
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