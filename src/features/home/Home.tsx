import { Modal } from "../../components/Modal";
import { RecentAssignmentsToGrade } from "./recentAssignmentsToGrade/RecentAssignmentsToGrade";
import { AvailableCoursesPanel } from "./settings/AvailableCoursesPanel";
import { SelectedCoursesPanel } from "./settings/SelectedCoursesPanel";

export const Home = () => {
  return (
    <div className="space-y-6 h-screen flex flex-col ">
      <h1 className="text-center">Grader</h1>
      <div className="flex-1 min-h-0 gap-6 flex flex-col ">
        <div className="flex justify-center">
          <div className="w-[600px]">
            <SelectedCoursesPanel />
          </div>
        </div>
        <br />
        <div className="flex justify-center">
          <Modal
            Button={({ onClick }) => (
              <button onClick={onClick} className="">
                Add Course
              </button>
            )}
            title={"Add Courses"}
          >
            {({ close: _close }) => <AvailableCoursesPanel />}
          </Modal>
        </div>
        <div>
          <RecentAssignmentsToGrade />
        </div>
      </div>
    </div>
  );
};
