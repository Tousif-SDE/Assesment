import { useDispatch } from 'react-redux'
import { setLanguage } from '../../redux/slices/editorSlice'

const LanguageSelector = ({ value, onChange, disabled = false, emitLanguageChange = null }) => {
  const dispatch = useDispatch()
  
  // Language options with Judge0 language IDs
  const languages = [
    { id: '71', name: 'Python (3.8.1)', icon: '🐍' },
    { id: '63', name: 'JavaScript (Node.js 12.14.0)', icon: '🟨' },
    { id: '54', name: 'C++ (GCC 9.2.0)', icon: '🔵' },
    { id: '50', name: 'C (GCC 9.2.0)', icon: '🔷' },
    { id: '62', name: 'Java (OpenJDK 13.0.1)', icon: '☕' },
  ]

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value
    
    // Update local state via passed onChange prop
    if (onChange) {
      onChange(newLanguage)
    }
    
    // Update Redux state directly
    dispatch(setLanguage(newLanguage))
    
    // Emit socket event if provided
    if (emitLanguageChange) {
      emitLanguageChange(newLanguage)
    }
  }

  return (
    <div className="inline-block mr-2">
      <select
        value={value}
        onChange={handleLanguageChange}
        disabled={disabled}
        className="py-1.5 px-4 text-sm bg-light border-0 shadow-sm rounded-full font-medium min-w-[200px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
      >
        {languages.map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.icon} {lang.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export default LanguageSelector