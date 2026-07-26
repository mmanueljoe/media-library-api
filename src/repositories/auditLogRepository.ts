import { AuditLog, type AuditLogDoc } from "../models/index.js";

export const createAuditLog = async (data: {
    userId: string;
    action: "create" | "update" | "delete" | "restore";
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
}): Promise<AuditLogDoc> => {
    return await AuditLog.create(data);
};

export const findAuditLogsByUser = async (
    userId: string,
    page = 1,
    limit = 20
): Promise<{ total: number; results: AuditLogDoc[] }> => {
    const skip = (page - 1) * limit;

    const [total, results] = await Promise.all([
        AuditLog.countDocuments({ userId }),
        AuditLog.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);

    return { total, results };
};
