// TEMP (local build/test only): point Node at public DNS so npm/next/font/Mongo resolve.
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
