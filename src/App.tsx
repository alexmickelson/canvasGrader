import { Route, Routes } from "react-router";
import { Home } from "./features/home/Home";
import { CoursePage } from "./features/course/CoursePage";
import { AssignmentGraderPage } from "./features/grader/AssignmentGraderPage";

function App() {
  return (
    <>
      <Routes>
        <Route
          path="/course/:courseId/assignment/:assignmentId"
          element={<AssignmentGraderPage />}
        />
        <Route path="/course/:courseId" element={<CoursePage />} />
        <Route path="/" element={<Home />} />
      </Routes>
    </>
  );
}

export default App;
