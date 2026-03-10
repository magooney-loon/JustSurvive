<script lang="ts">
	import { T } from '@threlte/core';
</script>

<!-- Placeholder: flat plane + ambient light. Replace with forest vista in Phase 3 art pass. -->
<T.AmbientLight intensity={0.5} />
<T.DirectionalLight position={[10, 20, 10]} intensity={1} />
<T.Mesh position={[0, -0.5, 0]}>
	<T.PlaneGeometry args={[100, 100]} />
	<T.MeshStandardMaterial color="#2d4a1e" />
</T.Mesh>
