// Package config provides module configuration types and built-in module definitions.
package config

// BuiltInModules contains all built-in modules.
var BuiltInModules []ModuleRegistryEntry

func init() {
	// Combine all module categories
	BuiltInModules = make([]ModuleRegistryEntry, 0,
		len(ValidatorModules)+
			len(ExecutorModules)+
			len(HookModules)+
			len(FallbackModules),
	)

	BuiltInModules = append(BuiltInModules, ValidatorModules...)
	BuiltInModules = append(BuiltInModules, ExecutorModules...)
	BuiltInModules = append(BuiltInModules, HookModules...)
	BuiltInModules = append(BuiltInModules, FallbackModules...)
}
