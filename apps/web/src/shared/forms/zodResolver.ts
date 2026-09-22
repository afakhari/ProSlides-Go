import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

export const createZodResolver = <TValues extends FieldValues>(
  schema: ZodType<TValues>,
): Resolver<TValues> => async (values) => {
  const result = schema.safeParse(values);

  if (result.success) {
    return {
      values: result.data,
      errors: {},
    };
  }

  const errors: FieldErrors<TValues> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || field in errors) continue;
    (errors as Record<string, unknown>)[field] = {
      type: issue.code,
      message: issue.message,
    };
  }

  return {
    values: {},
    errors,
  };
};
