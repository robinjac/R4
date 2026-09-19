import { root, useState } from '@lynx-js/react';

// Generated from R4 Semantic IR. ReactLynx is an isolated backend detail.
function R4App() {
	const [count, setCount] = useState(0);
	const doubled = count * 2;

	const handle_button_21 = () => {
			'background only';
			setCount((value) => value + 1);
		};

	return (
		<page style={{ width: '100%', height: '100%', backgroundColor: '#f3f0e8' }}>
			<view style={{"padding":"28px","width":"100%","minHeight":"100%"}}>
				<view style={{"gap":"28px","display":"flex","flexDirection":"column","alignItems":"stretch","justifyContent":"flex-start","flexWrap":"nowrap"}}>
					<view style={{"gap":"8px","display":"flex","flexDirection":"column","alignItems":"stretch","justifyContent":"flex-start","flexWrap":"nowrap"}}>
						<text style={{"fontSize":"12px","lineHeight":"17px","color":"#005bd7","textAlign":"left"}}>
							<text>{"COMPILER SLICE 01"}</text>
						</text>
						<text style={{"fontSize":"42px","fontWeight":"700","lineHeight":"44px","color":"#171b1e","textAlign":"left"}} accessibility-element={true} accessibility-traits="header">
							<text>{"State without a virtual tree."}</text>
						</text>
						<text style={{"fontSize":"16px","lineHeight":"24px","color":"#656c70","textAlign":"left"}}>
							<text>{"The same Svelte source renders here and projects into target-specific update work."}</text>
						</text>
					</view>
					<view style={{"padding":"28px","background":"#fffef9","borderRadius":"22px","border":"1px solid #d9d5c9"}}>
						<view style={{"gap":"18px","display":"flex","flexDirection":"column","alignItems":"stretch","justifyContent":"flex-start","flexWrap":"nowrap"}}>
							<view style={{"gap":"18px","display":"flex","flexDirection":"row","alignItems":"center","justifyContent":"space-between","flexWrap":"nowrap"}}>
								<view style={{"gap":"4px","display":"flex","flexDirection":"column","alignItems":"stretch","justifyContent":"flex-start","flexWrap":"nowrap"}}>
									<text style={{"fontSize":"12px","lineHeight":"17px","color":"#656c70","textAlign":"left"}}>
										<text>{"COUNT"}</text>
									</text>
									<text style={{"fontSize":"24px","fontWeight":"600","lineHeight":"29px","color":"#171b1e","textAlign":"left"}} accessibility-element={true} accessibility-traits="header">
										<text>{count}</text>
									</text>
								</view>
								<view style={{"gap":"4px","display":"flex","flexDirection":"column","alignItems":"flex-end","justifyContent":"flex-start","flexWrap":"nowrap"}}>
									<text style={{"fontSize":"12px","lineHeight":"17px","color":"#656c70","textAlign":"left"}}>
										<text>{"DERIVED"}</text>
									</text>
									<text style={{"fontSize":"24px","fontWeight":"600","lineHeight":"29px","color":"#171b1e","textAlign":"left"}} accessibility-element={true} accessibility-traits="header">
										<text>{doubled}</text>
									</text>
								</view>
							</view>
							<view style={{"minHeight":"44px","padding":"12px 18px","borderRadius":"12px","display":"flex","alignItems":"center","justifyContent":"center","backgroundColor":"#171b1e","color":"#ffffff"}} bindtap={handle_button_21} accessibility-element={true} accessibility-traits="button" accessibility-label={"Increment count"}>
								<text style={{"fontSize":"13px","fontWeight":"600","lineHeight":"17px","color":"#ffffff","textAlign":"left"}}>
									<text>{"Increment count"}</text>
								</text>
							</view>
						</view>
					</view>
				</view>
			</view>
		</page>
	);
}

root.render(<R4App />);

if (import.meta.webpackHot) {
	import.meta.webpackHot.accept();
}
