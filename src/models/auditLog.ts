import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        action: {
            type: String,
            required: true,
            enum: ["create", "update", "delete", "restore"],
        },
        resourceType: {
            type: String,
            required: true,
        },
        resourceId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ resourceId: 1, resourceType: 1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export type AuditLogSchema = mongoose.InferSchemaType<typeof auditLogSchema>;

export type AuditLogDoc = mongoose.HydratedDocument<AuditLogSchema>;
