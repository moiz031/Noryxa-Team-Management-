const appUrl = (process.env.VERIFY_APP_URL || "http://localhost:3000").replace(/\/$/, "");

for (const path of ["/dashboard", "/admin"]) {
  const response = await fetch(`${appUrl}${path}`, { redirect: "manual" });
  const location = response.headers.get("location") || "";
  if (response.status < 300 || response.status >= 400 || !location.includes("/login")) {
    throw new Error(`${path} was not protected: received ${response.status} ${location}`);
  }
  console.log(`PASS unauthenticated ${path} -> login`);
}
