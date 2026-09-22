import { body, param } from "express-validator";

const Role = { admin: "admin", user: "user" } as const;

export const userValidation = {
  create: [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .bail()
      .isLength({ max: 255 })
      .withMessage("Name must be less than 255 characters"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Please provide a email")
      .bail()
      .isString()
      .withMessage("Email must be a string.")
      .isEmail()
      .withMessage("Invalid Email Id. Please provide a valid email"),
    body("password")
      .trim()
      .notEmpty()
      .withMessage("Please provide a password.")
      .bail()
      .isString()
      .withMessage("Password must be a string")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("role")
      .notEmpty()
      .withMessage("Please provide a Role")
      .bail()
      .isIn(Object.values(Role))
      .withMessage("Role must be one of ADMIN or USER"),
    body("isVerified")
      .optional({ values: "null" })
      .isBoolean()
      .withMessage("isVerified must be a boolean value"),
    body("isBlocked")
      .optional({ values: "null" })
      .isBoolean()
      .withMessage("isBlocked must be a boolean value"),
    body("fcmToken.web")
      .optional({ values: "null" })
      .isString()
      .withMessage("FCM token (web) must be a string"),
    body("fcmToken.android")
      .optional({ values: "null" })
      .isString()
      .withMessage("FCM token (android) must be a string"),
    body("fcmToken.ios")
      .optional({ values: "null" })
      .isString()
      .withMessage("FCM token (iOS) must be a string"),
  ],
  login: [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Please provide a Email Id")
      .bail()
      .isString()
      .withMessage("Email Id must be a string")
      .bail()
      .isEmail()
      .withMessage("Invalid Email Id"),
    body("password")
      .trim()
      .notEmpty()
      .withMessage("Password is required")
      .bail()
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  changePassword: [
    body("oldPassword")
      .trim()
      .notEmpty()
      .withMessage("Old Password is required")
      .bail()
      .isString()
      .withMessage("Old Password must be a string")
      .isLength({ min: 6 })
      .withMessage("Old Password must be 6 characters long"),
    body("newPassword")
      .trim()
      .notEmpty()
      .withMessage("New Password is required")
      .isString()
      .withMessage("New Password must be a string")
      .isLength({ min: 6 })
      .withMessage("New Password must be 6 characters long")
      .custom((val, { req }) => {
        if (val !== req?.body?.oldPassword) return true;
        else return false;
      })
      .withMessage("Old Password and New Password can't be same"),
  ],
  update: [
    param("id")
      .notEmpty()
      .withMessage("Please provide a User Id.")
      .bail()
      .isMongoId()
      .withMessage("Invalid User Id. It should be a valid MongoId."),
    body("name")
      .optional({ values: "null" })
      .trim()
      .isLength({ max: 255 })
      .withMessage("Name must be less than 255 characters"),
    body("isBlocked")
      .optional({ values: "null" })
      .trim()
      .isBoolean()
      .withMessage("Block Status must be a boolean")
      .toBoolean(),
    body("role")
      .optional({ values: "null" })
      .isIn(Object.values(Role))
      .withMessage("Role must be one of ADMIN or USER"),
    body("fcmToken.web")
      .optional({ values: "null" })
      .isString()
      .withMessage("FCM token (web) must be a string"),
    body("avatar").optional({ values: "null" }).isString().withMessage("avatar must be a string"),
    body("avatarPath")
      .optional({ values: "null" })
      .isString()
      .withMessage("avatar path must be a string"),
    body("fcmToken.android")
      .optional({ values: "null" })
      .isString()
      .withMessage("FCM token (android) must be a string"),
    body("fcmToken.ios")
      .optional({ values: "null" })
      .isString()
      .withMessage("FCM token (iOS) must be a string"),
  ],
};
