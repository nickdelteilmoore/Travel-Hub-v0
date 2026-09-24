// Stand-in for bundled image assets under jest (node), where Metro's asset
// resolver isn't present. Metro hands <Image source> a numeric module id; the
// cover registry only needs a stable truthy value, so a number mirrors that.
module.exports = 1;
