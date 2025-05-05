
module.exports = {
	webpack: (config, { isServer }) => {
		if (!isServer) {
			config.target = "electron-renderer";
		}
		config.module.rules.push({
			test: /\.node$/,
			use: "node-loader"
		}),
		config.module.rules.push({
			test: /\.html$/,
			use: "html-loader"
		})
		
		return config
	},
	images: { unoptimized : true }
  }
  
