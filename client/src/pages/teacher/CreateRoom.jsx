import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateRoomMutation } from '../../redux/api/roomApi'

const CreateRoom = () => {
  const [formData, setFormData] = useState({
    tutor: '',
    college: '',
    batchYear: '',
    totalStudents: '',
    totalDuration: '',
  })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const navigate = useNavigate()
  const [createRoom, { isLoading }] = useCreateRoomMutation()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const generateRoomCode = () => {
    // Generate a room code like 1F201 as shown in the UI design
    const prefix = '1F'
    const randomNum = Math.floor(100 + Math.random() * 900) // 3-digit number
    return `${prefix}${randomNum}`
  }

  const submitHandler = async (e) => {
    e.preventDefault()
    setError(null)

    try {
      // Add room code to form data
      const roomData = {
        roomName: formData.tutor, // Use tutor as roomName
        subject: "Programming", // Default subject
        batchYear: formData.batchYear,
        college: formData.college,
        tutor: formData.tutor, // Add tutor field
        code: generateRoomCode(),
        totalStudents: parseInt(formData.totalStudents),
        totalDuration: parseInt(formData.totalDuration),
      }

      const result = await createRoom(roomData).unwrap()
      setSuccess(`Room created successfully! Room code: ${result.code}`)
      
      // Redirect to teacher dashboard after 2 seconds
      setTimeout(() => {
        navigate('/teacher')
      }, 2000)
    } catch (err) {
      console.error('Error creating room:', err);
      setError(err?.data?.message || 'Failed to create room')
    }
  }

  return (
    <div className="container mx-auto mt-8 px-4">
      <div className="flex justify-center">
        <div className="w-full max-w-2xl">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-center mb-6">
              Create Live Code Room
            </h2>
            
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
            {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{success}</div>}
            
            <form onSubmit={submitHandler}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <input
                    type="text"
                    id="tutor"
                    name="tutor"
                    value={formData.tutor}
                    onChange={handleChange}
                    placeholder="Tutor"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                
                <div>
                  <input
                    type="text"
                    id="college"
                    name="college"
                    value={formData.college}
                    onChange={handleChange}
                    placeholder="College"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <input
                    type="text"
                    id="batchYear"
                    name="batchYear"
                    value={formData.batchYear}
                    onChange={handleChange}
                    placeholder="Batch Year"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                
                <div>
                  <input
                    type="number"
                    id="totalStudents"
                    name="totalStudents"
                    value={formData.totalStudents}
                    onChange={handleChange}
                    placeholder="Batches (Total Students)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="mb-6">
                <input
                  type="number"
                  id="totalDuration"
                  name="totalDuration"
                  value={formData.totalDuration}
                  onChange={handleChange}
                  placeholder="Total Duration"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="flex justify-center">
                <button
                  type="submit"
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-6 rounded-full"
                  disabled={isLoading || success}
                >
                  {isLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateRoom;