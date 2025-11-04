import { Route, Routes } from "react-router";
import { Home } from "./features/home/Home";
import { CoursePage } from "./features/course/CoursePage";
import { AssignmentGraderPage } from "./features/grader/AssignmentGraderPage";
import { SuspenseAndError } from "./utils/SuspenseAndError";

function App() {
  return (
    <>
      <Routes>
        <Route
          path="/course/:courseId/assignment/:assignmentId"
          element={
            <SuspenseAndError>
              <AssignmentGraderPage />
            </SuspenseAndError>
          }
        />
        <Route
          path="/course/:courseId"
          element={
            <SuspenseAndError>
              <CoursePage />
            </SuspenseAndError>
          }
        />
        <Route path="/" element={<Home />} />
      </Routes>
    </>
  );
}

export default App;
