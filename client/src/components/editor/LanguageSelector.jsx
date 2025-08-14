import { useDispatch, useSelector } from 'react-redux'
import { Form } from 'react-bootstrap'
import { setLanguage } from '../../redux/slices/editorSlice'

const LanguageSelector = ({ value, onChange, disabled = false, emitLanguageChange = null }) => {
  const dispatch = useDispatch()
  
  // Get current language from Redux
  const reduxLanguage = useSelector(state => state.editor.language)

  // Judge0 language IDs as numbers
  const languages = [
    { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
    { id: 71, name: 'Python (3.8.1)' },
    { id: 62, name: 'Java (OpenJDK 13.0.1)' },
    { id: 54, name: 'C++ (GCC 9.2.0)' },
    { id: 50, name: 'C (GCC 9.2.0)' },
  ]

  const handleLanguageChange = (e) => {
    try {
      const newLanguageId = parseInt(e.target.value, 10)
      
      // Find the language to validate
      const selectedLanguage = languages.find(lang => lang.id === newLanguageId)
      
      if (!selectedLanguage) {
        console.error('Invalid language ID:', newLanguageId)
        return
      }

      // Update Redux
      dispatch(setLanguage(newLanguageId))

      // Call any local onChange handler
      if (onChange && typeof onChange === 'function') {
        onChange(newLanguageId)
      }

      // Notify parent via socket / emit
      if (emitLanguageChange && typeof emitLanguageChange === 'function') {
        emitLanguageChange(newLanguageId)
      }
      
    } catch (error) {
      console.error('Error in handleLanguageChange:', error)
    }
  }

  // Determine current value with proper type conversion and fallback
  const getCurrentValue = () => {
    // Priority: prop value -> redux value -> default (63 for JavaScript)
    let currentVal = value !== undefined ? value : reduxLanguage
    
    if (currentVal === undefined || currentVal === null) {
      return 63 // Default to JavaScript
    }
    
    // Convert to number
    const numVal = parseInt(currentVal, 10)
    
    // Validate that it's a valid language ID
    const isValid = languages.some(lang => lang.id === numVal)
    
    return isValid ? numVal : 63 // Fallback to JavaScript if invalid
  }

  const currentValue = getCurrentValue()

  return (
    <div className="d-inline-block">
      <Form.Select
        value={currentValue}
        onChange={handleLanguageChange}
        disabled={disabled}
        className="fw-semibold"
        style={{
          background: disabled ? '#EDE9FE' : '#A78BFA',
          borderRadius: '20px',
          padding: '10px 18px',
          fontSize: '1rem',
          minWidth: '220px',
          color: '#fff',
          border: '2px solid transparent',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          transition: 'all 0.2s ease',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.7 : 1,
        }}
        onFocus={(e) => {
          if (!disabled) {
            e.target.style.background = '#8B5CF6'
            e.target.style.borderColor = '#7C3AED'
          }
        }}
        onBlur={(e) => {
          if (!disabled) {
            e.target.style.background = '#A78BFA'
            e.target.style.borderColor = 'transparent'
          }
        }}
      >
        {languages.map((lang) => (
          <option
            key={lang.id}
            value={lang.id}
            style={{
              background: '#FFFFFF',
              color: '#374151',
              padding: '8px 12px',
            }}
          >
            {lang.name}
          </option>
        ))}
      </Form.Select>
    </div>
  )
}

export default LanguageSelector