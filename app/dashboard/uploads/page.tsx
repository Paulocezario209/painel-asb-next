import { OrdersUpload } from "@/components/uploads/orders-upload";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";

export default async function UploadsPage() {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/uploads")) redirect("/dashboard");

  return (
    <div style={{ padding: "32px 24px", maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            color: "#FFFFFF",
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "'Courier New', monospace",
            letterSpacing: ".08em",
            marginBottom: 6,
          }}
        >
          Upload de pedidos (XLSX)
        </h1>
        <p style={{ color: "#556677", fontSize: 11, fontFamily: "'Courier New', monospace", letterSpacing: ".1em" }}>
          Upload manual 2x/dia · Formato esperado: export ARES XLSX
        </p>
      </div>

      <OrdersUpload />
    </div>
  );
}
