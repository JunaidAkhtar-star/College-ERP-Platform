import mongoose from "mongoose";
import { configs } from "../configs";
import { ALL_ROLES, type SystemRole } from "../constants/roles";
import { RoleModel } from "../models/role.model";
import { UserModel } from "../models/user.model";
import { DEFAULT_PERMISSIONS, mergeMissingDefaultPermissions } from "../constants/role-defaults";

async function migrate() {
  await mongoose.connect(configs.MONGODB_URI);
  const roles = await RoleModel.find({ name: { $in: ALL_ROLES }, isSystem: true })
    .lean()
    .exec();
  const roleResult = await RoleModel.bulkWrite(
    roles.map((role) => {
      const roleName = role.name as SystemRole;
      return {
        updateOne: {
          filter: { _id: role._id },
          update: {
            $set: {
              baseRole: roleName,
              permissions: mergeMissingDefaultPermissions(
                role.permissions ?? [],
                DEFAULT_PERMISSIONS[roleName],
              ),
            },
          },
        },
      };
    }),
  );
  const userResult = await UserModel.updateMany(
    { customRoleIds: { $exists: false } },
    { $set: { customRoleIds: [] } },
  );
  console.log(
    `Assignable RBAC migration complete: roles=${roleResult.modifiedCount}, users=${userResult.modifiedCount}`,
  );
}

migrate()
  .catch((error: unknown) => {
    console.error("Assignable RBAC migration failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
