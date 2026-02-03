import { Modal } from "../../components/Modal";
import { useDeleteAllCourseDataMutation } from "../../utils/canvas/canvasAssignmentHooks";
import { useNavigate } from "react-router";

export const PurgeCourseDataButton = () => {
  const deleteAllCourseDataMutation = useDeleteAllCourseDataMutation();
  const navigate = useNavigate();
  return (
    <Modal
      title="Purge Course Data"
      width="lg"
      Button={({ onClick }) => (
        <button
          onClick={onClick}
          className={`
            unstyled
            px-3 py-2
            bg-red-900/80 hover:bg-red-950 disabled:bg-gray-600
            rounded-md
            font-medium
            disabled:cursor-not-allowed
            transition-colors
          `}
        >
          Purge Course Data
        </button>
      )}
    >
      {({ close }) => (
        <div className="p-4">
          <p className="mb-4">
            Are you sure you want to purge all data for this course? This action
            cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={close}
              className={`
                unstyled
                px-3 py-2
                bg-gray-600 hover:bg-gray-700
                rounded-md
                text-sm font-medium
                transition-colors
              `}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await deleteAllCourseDataMutation.mutateAsync();
                close();
                navigate("/");
              }}
              className={`
                unstyled
                px-3 py-2
              bg-red-900/80 hover:bg-red-950 disabled:bg-gray-600
                rounded-md
                text-sm font-medium
                transition-colors
              `}
              disabled={deleteAllCourseDataMutation.isPending}
            >
              {deleteAllCourseDataMutation.isPending
                ? "Purging..."
                : "Yes, Purge Data"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
