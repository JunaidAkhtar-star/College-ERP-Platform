import { query } from "express-validator";

export const commonValidation = [
  query("perPage")
    .optional({ nullable: true })
    .isNumeric()
    .withMessage("Please provide a valid number for 'per page'.")
    .custom((value) => {
      if (parseInt(value) > 0) return true;
      else return false;
    })
    .withMessage("'Per page' must be greater than 0.")
    .toInt(),
  query("pageNo")
    .optional({ nullable: true })
    .isNumeric()
    .withMessage("Please provide a valid number for 'page number'.")
    .custom((value) => {
      if (parseInt(value) < 0) return false;
      else return true;
    })
    .withMessage("'Page Number' must be greater than 0 or equals to 0.")
    .toInt(),
  query("search")
    .optional({ nullable: true })
    .isString()
    .withMessage("Please provide a valid string for 'search'."),
  query("descending")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("Please provide a valid boolean value for 'descending' (true).")
    .toBoolean(),
  query("ascending")
    .optional({ nullable: true })
    .isBoolean()
    .withMessage("Please provide a valid boolean value for 'ascending' (true).")
    .toBoolean(),
];
