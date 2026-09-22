import * as Yup from 'yup';
export const assessmentPolicySchema = Yup.object({
  name: Yup.string().trim().required('Policy name is required'),
  code: Yup.string().trim().required('Policy code is required'),
  version: Yup.number().integer().min(1).required(),
  effectiveFrom: Yup.string().required('Effective date is required'),
  maximumMarks: Yup.number().positive().required(),
  minimumTotalMarks: Yup.number().min(0).required(),
  resultTarget: Yup.string().oneOf(['internal', 'external', 'standalone']).required(),
  gradeScale: Yup.array().of(
    Yup.object({
      letter: Yup.string().trim().required(),
      minimumPercentage: Yup.number().min(0).max(100).required(),
      point: Yup.number().min(0).required(),
    }),
  ),
  components: Yup.array()
    .min(1, 'Add at least one component')
    .of(
      Yup.object({
        key: Yup.string().trim().required(),
        name: Yup.string().trim().required(),
        maximumMarks: Yup.number().positive().required(),
        minimumPassMarks: Yup.number().min(0).required(),
        attemptCount: Yup.number().integer().min(1).required(),
      }),
    ),
});
