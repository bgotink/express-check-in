module.exports = {
  name: '@yarnpkg/plugin-clean-publish',
  factory() {
    return {
      hooks: {
        beforeWorkspacePacking(workspace, rawManifest) {
          delete rawManifest.scripts;
          delete rawManifest.devDependencies;
        },
      },
    };
  },
};
