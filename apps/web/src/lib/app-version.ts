import packageJson from "../../package.json";

/** "0.1.0+3f9c2a1": package version plus the build's git commit (`GIT_SHA`, set by the deploy). */
export const APP_VERSION = `${packageJson.version}+${process.env.GIT_SHA?.slice(0, 7) || "dev"}`;
