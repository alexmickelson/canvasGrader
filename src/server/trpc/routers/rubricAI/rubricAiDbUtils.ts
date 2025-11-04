import { db } from "../../../services/dbUtils";
import { parseSchema } from "../parseSchema";
import {
  FullEvaluationSchema,
  type FullEvaluation,
} from "./rubricAiReportModels";

export async function storeRubricCriterionAnalysis({
  submissionId,
  evaluation,
}: {
  submissionId: number;
  evaluation: FullEvaluation;
}) {
  return await db.one(
    `
    INSERT INTO rubric_criterion_analysis (rubric_criterion_id, submission_id, evaluation_object)
    VALUES ($<rubricCriterionId>, $<submissionId>, $<evaluationObject>)
    RETURNING id
    `,
    {
      rubricCriterionId: evaluation.metadata.criterionId,
      submissionId,
      evaluationObject: evaluation,
    }
  );
}

export async function getRubricCriterionAnalysesBySubmission(
  submissionId: number
) {
  const result = await db.manyOrNone(
    `
    SELECT id, rubric_criterion_id, submission_id, evaluation_object
    FROM rubric_criterion_analysis
    WHERE submission_id = $<submissionId>
    ORDER BY id
    `,
    { submissionId }
  );

  return result.map((r) =>
    parseSchema(
      FullEvaluationSchema,
      r.evaluation_object,
      "FullEvaluation from DB"
    )
  );
}
