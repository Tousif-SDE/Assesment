// client/src/pages/teacher/CreateRoom.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateRoomMutation } from "../../redux/api/roomApi";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  Navbar,
} from "react-bootstrap";
import {
  ArrowLeft,
  Plus,
  Users,
  Clock,
  BookOpen,
  Building,
} from "lucide-react";

const CreateRoom = () => {
  const [formData, setFormData] = useState({
    tutor: "",
    college: "",
    batchYear: "",
    totalStudents: "",
    totalDuration: "",
    description: "",
  });

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const navigate = useNavigate();
  const [createRoom, { isLoading }] = useCreateRoomMutation();

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Generate unique room code
  const generateRoomCode = () => {
    const prefix = "1F";
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `${prefix}${randomNum}`;
  };

  // Form submit handler
  const submitHandler = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const roomData = {
        roomName: formData.tutor,
        subject: "Programming",
        batchYear: formData.batchYear,
        college: formData.college,
        tutor: formData.tutor,
        code: generateRoomCode(),
        totalStudents: parseInt(formData.totalStudents, 10),
        totalDuration: parseInt(formData.totalDuration, 10),
        description: formData.description,
      };

      const result = await createRoom(roomData).unwrap();
      setSuccess(`Room created successfully! Room code: ${result.code}`);

      setTimeout(() => {
        navigate("/teacher");
      }, 2000);
    } catch (err) {
      console.error("Error creating room:", err);
      setError(err?.data?.message || "Failed to create room");
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #f5f3ff, #ede9fe, #ddd6fe)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Navbar className="bg-white shadow-sm border-0 py-3">
        <Container fluid className="px-4 d-flex justify-content-between">
          <div className="d-flex align-items-center">
            <Button
              variant="link"
              className="p-0 me-3 text-decoration-none"
              onClick={() => navigate("/teacher")}
              style={{ color: "#6b7280" }}
            >
              <ArrowLeft size={20} />
            </Button>
            <div
              className="d-flex align-items-center justify-content-center me-2"
              style={{
                width: "32px",
                height: "32px",
                background: "linear-gradient(45deg, #6366f1, #8b5cf6)",
                borderRadius: "8px",
              }}
            >
              <span className="text-white fw-bold" style={{ fontSize: "14px" }}>
                S
              </span>
            </div>
            <span
              className="fs-4 fw-bold"
              style={{
                background: "linear-gradient(45deg, #6366f1, #8b5cf6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              skelo
            </span>
          </div>
          <div
            className="px-3 py-1 rounded-pill"
            style={{
              backgroundColor: "#f3f4f6",
              color: "#374151",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Teacher Access
          </div>
        </Container>
      </Navbar>

      {/* Main Content */}
      <Container className="py-5 flex-grow-1" fluid>
        <Row className="justify-content-center">
          <Col lg={8} xl={7}>
            <Card
              className="shadow-lg border-0"
              style={{ borderRadius: "20px" }}
            >
              {/* Card Header */}
              <div
                className="text-center text-white p-4"
                style={{
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  borderTopLeftRadius: "20px",
                  borderTopRightRadius: "20px",
                }}
              >
                <div
                  className="mx-auto mb-3 d-flex align-items-center justify-content-center"
                  style={{
                    width: "56px",
                    height: "56px",
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    borderRadius: "12px",
                  }}
                >
                  <Plus size={28} className="text-white" />
                </div>
                <h4 className="fw-bold mb-1">Create Live Code Room</h4>
                <p className="mb-0 opacity-75" style={{ fontSize: "14px" }}>
                  Set up your coding session for students
                </p>
              </div>

              <Card.Body className="p-4">
                {/* Error Alert */}
                {error && (
                  <Alert
                    variant="danger"
                    className="d-flex align-items-center border-0 mb-4"
                    style={{
                      backgroundColor: "#fef2f2",
                      borderRadius: "12px",
                    }}
                  >
                    <div
                      className="rounded-circle me-3"
                      style={{
                        width: "18px",
                        height: "18px",
                        backgroundColor: "#ef4444",
                      }}
                    />
                    <div style={{ fontSize: "14px" }}>{error}</div>
                  </Alert>
                )}

                {/* Success Alert */}
                {success && (
                  <Alert
                    variant="success"
                    className="d-flex align-items-center border-0 mb-4"
                    style={{
                      backgroundColor: "#f0fdf4",
                      borderRadius: "12px",
                    }}
                  >
                    <div
                      className="rounded-circle me-3"
                      style={{
                        width: "18px",
                        height: "18px",
                        backgroundColor: "#22c55e",
                      }}
                    />
                    <div style={{ fontSize: "14px" }}>{success}</div>
                  </Alert>
                )}

                {/* Form */}
                <Form onSubmit={submitHandler}>
                  <Row className="g-4 mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-semibold mb-2 d-flex align-items-center">
                          <Users size={16} className="me-2" /> Tutor
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="tutor"
                          value={formData.tutor}
                          onChange={handleChange}
                          placeholder="Enter tutor name"
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-semibold mb-2 d-flex align-items-center">
                          <Building size={16} className="me-2" /> College
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="college"
                          value={formData.college}
                          onChange={handleChange}
                          placeholder="Enter college name"
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row className="g-4 mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-semibold mb-2 d-flex align-items-center">
                          <BookOpen size={16} className="me-2" /> Batch Year
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="batchYear"
                          value={formData.batchYear}
                          onChange={handleChange}
                          placeholder="e.g., 2024"
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="fw-semibold mb-2 d-flex align-items-center">
                          <Users size={16} className="me-2" /> Total Students
                        </Form.Label>
                        <Form.Control
                          type="number"
                          name="totalStudents"
                          value={formData.totalStudents}
                          onChange={handleChange}
                          placeholder="Enter number of students"
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row className="mb-4">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label className="fw-semibold mb-2 d-flex align-items-center">
                          <Clock size={16} className="me-2" /> Total Duration
                          (minutes)
                        </Form.Label>
                        <Form.Control
                          type="number"
                          name="totalDuration"
                          value={formData.totalDuration}
                          onChange={handleChange}
                          placeholder="Enter duration in minutes"
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row className="mb-4">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label className="fw-semibold mb-2">Room Description</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={4}
                          name="description"
                          value={formData.description}
                          onChange={handleChange}
                          placeholder="Describe the problem set or session details..."
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Submit Button */}
                  <div className="text-end">
                    <Button
                      type="submit"
                      disabled={isLoading || success}
                      className="fw-semibold border-0 px-4"
                      style={{
                        background:
                          isLoading || success
                            ? "#9ca3af"
                            : "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
                        borderRadius: "12px",
                        fontSize: "15px",
                        height: "45px",
                      }}
                    >
                      {isLoading ? (
                        <>
                          <div
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                          >
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          Creating...
                        </>
                      ) : success ? (
                        "Room Created Successfully!"
                      ) : (
                        "Create"
                      )}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default CreateRoom;
