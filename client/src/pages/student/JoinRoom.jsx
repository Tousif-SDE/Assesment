import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJoinRoomMutation } from '../../redux/api/roomApi'

const JoinRoom = () => {
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState(null)
  
  const navigate = useNavigate()
  const [joinRoom, { isLoading }] = useJoinRoomMutation()

  const submitHandler = async (e) => {
    e.preventDefault()
    setError(null)

    if (!roomCode.trim()) {
      setError('Please enter a room code')
      return
    }

    try {
      // Pass the code as an object with a code property
      const result = await joinRoom({ code: roomCode }).unwrap()
      navigate(`/student/room/${result.room.id}`)
    } catch (err) {
      console.error('Error joining room:', err)
      setError(err?.data?.message || 'Failed to join room')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-center">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-center mb-4">
              Student - Join Live Room
            </h2>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={submitHandler}>
              <div className="mb-4">
                <input
                  type="text"
                  id="roomCode"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="Enter Code"
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex justify-center">
                <button
                  type="submit"
                  className={`bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-6 rounded-full ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  disabled={isLoading}
                >
                  {isLoading ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JoinRoom