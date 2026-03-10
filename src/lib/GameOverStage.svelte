<script lang="ts">
	import { T } from '@threlte/core';
</script>

<T.AmbientLight intensity={0.05} color="#1a1a4a" />
<T.Mesh position={[0, -0.5, 0]}>
	<T.PlaneGeometry args={[100, 100]} />
	<T.MeshStandardMaterial color="#0a0a0a" />
</T.Mesh>
