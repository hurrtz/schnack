const { withPodfileProperties } = require("@expo/config-plugins");

module.exports = function withBuildReactNativeFromSource(config) {
  return withPodfileProperties(config, (config) => {
    config.modResults["ios.buildReactNativeFromSource"] = "true";
    return config;
  });
};
