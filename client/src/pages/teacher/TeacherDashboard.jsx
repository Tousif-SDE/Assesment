import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useGetMyRoomsQuery } from '../../redux/api/roomApi'

const TeacherDashboard = () => {
  const { data: rooms, error, isLoading, refetch } = useGetMyRoomsQuery()

  useEffect(() => {
    // Refetch rooms when component mounts
    refetch()
  }, [])

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
          <svg className="animate-spin h-8 w-8 text-gray-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms?.map((room) => (
            <div key={room.id} className="mb-4">
              <div className="h-full bg-white rounded-lg shadow-sm border border-gray-100">
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
                <div className="bg-white p-3 text-right border-t">
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
    </div>
  )
}

export default TeacherDashboard